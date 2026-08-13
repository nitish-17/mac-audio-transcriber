import os
import sys
import time
import subprocess
import tempfile
import wave
import numpy as np

HALLUCINATION_PATTERNS = {
    "you", "you.", "you...", "you!", "you?", "thank you.", "thank you",
    "subtitles by", "subtitles by creator", "subtitles", "subscribe", "bye",
    "bye.", "thanks for watching", "thanks for watching!", "[blank_audio]",
    "(music)", "[music]", "(silence)", "[silence]"
}

class Transcriber:
    def __init__(self, project_dir: str, transcript_filename: str = "transcript.txt"):
        self.project_dir = project_dir
        self.transcript_path = os.path.join(project_dir, transcript_filename)
        self.whisper_cli = os.path.join(project_dir, "whisper.cpp", "build", "bin", "whisper-cli")
        self.model_path = os.path.join(project_dir, "whisper.cpp", "models", "ggml-large-v3-turbo.bin")
        
        self.sample_rate = 16000
        self.audio_buffer = np.array([], dtype=np.float32)
        
        # Audio chunking duration (~4.0 seconds per audio segment)
        self.target_chunk_duration = 4.0
        self.last_prompt = ""
        self.is_processing = False

        print(f"[Transcriber] Initialized.")
        print(f"[Transcriber] Output file: {self.transcript_path}")

    def add_audio_data(self, raw_pcm_bytes: bytes):
        """Receives 16kHz Mono 16-bit Int16 PCM byte data from WebSocket stream."""
        if not raw_pcm_bytes:
            return

        int16_samples = np.frombuffer(raw_pcm_bytes, dtype=np.int16)
        float32_samples = int16_samples.astype(np.float32) / 32768.0

        self.audio_buffer = np.concatenate((self.audio_buffer, float32_samples))
        
        buffer_len_sec = len(self.audio_buffer) / self.sample_rate
        if buffer_len_sec >= self.target_chunk_duration and not self.is_processing:
            self._process_buffer()

    def flush_remaining(self):
        """Forces transcription of any remaining audio in buffer when recording stops."""
        if len(self.audio_buffer) >= int(0.5 * self.sample_rate):
            self._process_buffer()
        self.last_prompt = ""
        self.audio_buffer = np.array([], dtype=np.float32)

    def _process_buffer(self):
        if len(self.audio_buffer) == 0 or self.is_processing:
            return

        self.is_processing = True
        chunk_to_transcribe = self.audio_buffer.copy()
        self.audio_buffer = np.array([], dtype=np.float32)

        try:
            text = self._run_whisper(chunk_to_transcribe)
            if text and self._is_valid_transcription(text):
                print(f"[SAVED TO transcript.txt]: {text}")
                self._append_to_transcript(text)
                words = text.split()
                self.last_prompt = " ".join(words[-20:])
            else:
                if text:
                    print(f"[Ignored Hallucination/Silence]: \"{text}\"")
                self.last_prompt = ""
        except Exception as e:
            print(f"[Transcriber Error]: {e}", file=sys.stderr)
        finally:
            self.is_processing = False

    def _is_valid_transcription(self, text: str) -> bool:
        clean = text.strip().lower()
        if not clean or len(clean) < 2:
            return False
        
        if clean in HALLUCINATION_PATTERNS:
            return False

        words = clean.split()
        if len(words) == 1 and words[0] in HALLUCINATION_PATTERNS:
            return False

        if len(words) > 1 and len(set(words)) == 1:
            return False

        return True

    def _run_whisper(self, float32_samples: np.ndarray) -> str:
        if len(float32_samples) == 0:
            return ""

        rms = np.sqrt(np.mean(float32_samples ** 2))
        if rms < 0.0001:
            return ""

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
                "-nt",
                "-np",
                "-l", "auto",
                "-t", "4"
            ]

            if self.last_prompt:
                cmd.extend(["--prompt", self.last_prompt])

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            output = result.stdout.strip()

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
        if not text:
            return

        with open(self.transcript_path, "a", encoding="utf-8") as f:
            f.write(text + "\n")
            f.flush()
            os.fsync(f.fileno())
