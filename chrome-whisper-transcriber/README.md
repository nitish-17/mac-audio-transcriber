# Chrome Whisper Transcriber 🎙️⚡

A 100% local, private, on-device macOS continuous audio transcriber. Captures audio playing from any Chrome tab (YouTube, streaming videos, podcasts, protected streams) and transcribes speech live into `~/Documents/notes/files/transcript.txt` using **Metal-accelerated `whisper.cpp`**.

---

## 🌟 Why this approach is superior

* **No 60-Second Timeout / Resets**: Replaces Apple Speech (`SFSpeechRecognizer`) with local `whisper.cpp`, eliminating random resets, session cutoffs, and dropped words.
* **Apple Silicon Metal Acceleration**: Uses GGML Metal GPU backend (`GGML_METAL=ON`) to run `large-v3-turbo` model at 10x-30x real-time speed.
* **VAD Speech Segmentation**: Audio is split on natural speech pauses instead of arbitrary cutoffs.
* **Pure Tab Isolation**: Captures audio directly from the Chrome tab using `chrome.tabCapture` — zero microphone background noise, zero system alerts.
* **Simultaneous Audio Playback**: Audio continues playing out your speakers normally while being transcribed.

---

## 🚀 Quick Start

### 1. Initial Setup (One-time)

Run the setup script to build `whisper.cpp` with Metal support and download the high-accuracy `large-v3-turbo` model (~1.5GB):

```bash
cd chrome-whisper-transcriber
./setup_whisper.sh
```

### 2. Start the Server

```bash
./server/start_server.sh
```

The server will listen on `ws://127.0.0.1:8000` and append transcriptions directly to `~/Documents/notes/files/transcript.txt`.

### 3. Load Chrome Extension

1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `chrome-whisper-transcriber/extension/` folder.

### 4. Transcribe!

1. Open any Chrome tab playing video or audio.
2. Click the **Whisper Transcriber** extension icon in Chrome.
3. Click **Start Recording**.
4. Enjoy listening to your video — the speech will be continuously transcribed and appended to `~/Documents/notes/files/transcript.txt`!
