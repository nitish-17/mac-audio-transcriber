import os
import sys
import time
import subprocess
import tempfile
import wave
import numpy as np

class Transcriber:
    def __init__(self, project_dir: str, transcript_filename: str = "transcript.txt"):
        self.project_dir = project_dir
        self.transcript_path = os.path.join(project_dir, transcript_filename)
        self.whisper_cli = os.path.join(project_dir, "whisper.cpp", "build", "bin", "whisper-cli")
        self.model_path = os.path.join(project_dir, "whisper.cpp", "models", "ggml-large-v3-turbo.bin")
        
        # Audio configuration
        self.sample_rate = 16000
        self.bytes_per_sample = 2  # Int16
        
        # Audio Buffers & VAD thresholds
        self.audio_buffer = np.array([], dtype=np.float32)
        self.silence_threshold = 0.010  # Energy (RMS) threshold for silence detection
        self.silence_duration_target = 0.6  # Seconds of silence to trigger segment transcription
        self.min_speech_duration = 1.5       # Minimum speech length in seconds before transcribing
        self.max_buffer_duration = 15.0      # Hard maximum buffer length in seconds
        
        self.last_prompt = ""
        self.silent_frames_count = 0
        self.is_processing = False

        print(f"Transcriber initialized.")
        print(f"Transcript output path: {self.transcript_path}")
        print(f"Whisper CLI: {self.whisper_cli}")
        print(f"Model path: {self.model_path}")

    def add_audio_data(self, raw_pcm_bytes: bytes):
        """
        Receives 16kHz Mono 16-bit Int16 PCM byte data from WebSocket stream.
        Appends to internal float32 audio buffer and checks VAD boundaries.
        """
        if not raw_pcm_bytes:
            return

        # Convert raw int16 bytes to normalized float32 numpy array [-1.0, 1.0]
        int16_samples = np.frombuffer(raw_pcm_bytes, dtype=np.int16)
        float32_samples = int16_samples.astype(np.float32) / 32768.0

        self.audio_buffer = np.concatenate((self.audio_buffer, float32_samples))

        # Check if we should trigger transcription
        self._check_vad_trigger()

    def _check_vad_trigger(self):
        buffer_len_sec = len(self.audio_buffer) / self.sample_rate

        if buffer_len_sec < self.min_speech_duration:
            return

        # Calculate energy (RMS) of the latest 300ms window
        recent_samples = self.audio_buffer[-int(0.3 * self.sample_rate):]
        rms = np.sqrt(np.mean(recent_samples ** 2)) if len(recent_samples) > 0 else 0.0

        if rms < self.silence_threshold:
            self.silent_frames_count += 1
        else:
            self.silent_frames_count = 0

        silence_sec = (self.silent_frames_count * 0.3)

        # Trigger if silence gap reached or max buffer duration exceeded
        if silence_sec >= self.silence_duration_target or buffer_len_sec >= self.max_buffer_duration:
            self._process_buffer()

    def _process_buffer(self):
        if len(self.audio_buffer) == 0 or self.is_processing:
            return

        self.is_processing = True
        chunk_to_transcribe = self.audio_buffer.copy()
        # Clear main buffer
        self.audio_buffer = np.array([], dtype=np.float32)
        self.silent_frames_count = 0

        try:
            text = self._run_whisper(chunk_to_transcribe)
            if text:
                print(f"[Transcribed]: {text}")
                self._append_to_transcript(text)
                # Keep trailing context for next prompt
                words = text.split()
                self.last_prompt = " ".join(words[-30:])
        except Exception as e:
            print(f"Error during transcription: {e}", file=sys.stderr)
        finally:
            self.is_processing = False

    def flush_remaining(self):
        """Forces transcription of any remaining audio in buffer (e.g., when recording stops)."""
        if len(self.audio_buffer) >= int(0.5 * self.sample_rate):
            self._process_buffer()

    def _run_whisper(self, float32_samples: np.ndarray) -> str:
        """Saves samples to temporary WAV and runs whisper-cli with Metal GPU acceleration."""
        if len(float32_samples) == 0:
            return ""

        # Convert back to Int16 for WAV writing
        int16_samples = (float32_samples * 32767.0).clip(-32768, 32767).astype(np.int16)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
            tmp_wav_path = tmp_wav.name

        try:
            with wave.open(tmp_wav_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(self.sample_rate)
                wf.writeframes(int16_samples.tobytes())

            cmd = [
                self.whisper_cli,
                "-m", self.model_path,
                "-f", tmp_wav_path,
                "-nt",                # No timestamps
                "-np",                # No extra prints
                "-l", "auto",         # Auto-detect language
                "-t", "4",            # 4 CPU threads (alongside Metal GPU)
            ]

            if self.last_prompt:
                cmd.extend(["--prompt", self.last_prompt])

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            output = result.stdout.strip()

            # Clean output (strip hallucinated tags like [BLANK_AUDIO], (music), etc.)
            lines = []
            for line in output.splitlines():
                line_clean = line.strip()
                if line_clean and not (line_clean.startswith("[") and line_clean.endswith("]")):
                    lines.append(line_clean)

            return " ".join(lines).strip()
        finally:
            if os.path.exists(tmp_wav_path):
                try:
                    os.remove(tmp_wav_path)
                except OSError:
                    pass

    def _append_to_transcript(self, text: str):
        """Appends text to file and flushes disk cache immediately."""
        if not text:
            return

        with open(self.transcript_path, "a", encoding="utf-8") as f:
            f.write(text + "\n")
            f.flush()
            os.fsync(f.fileno())
