# Chrome Audio Transcriber (whisper.cpp) 🎙️⚡

100% local, private macOS Chrome audio transcriber. Captures audio playing from any Chrome tab and transcribes speech live into `chrome-whisper-transcriber/transcript.txt` using Metal GPU-accelerated `whisper.cpp` (`large-v3-turbo` model).

---

## 🛠️ One-Time Setup

Run the setup script (clones `whisper.cpp`, compiles with Metal GPU acceleration, and downloads the `large-v3-turbo` model):

```bash
cd chrome-whisper-transcriber
./setup_whisper.sh
```

---

## 🚀 How to Run

### 1. Start the Server

```bash
cd chrome-whisper-transcriber
./server/start_server.sh
```

### 2. Load Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `chrome-whisper-transcriber/extension/`.

### 3. Start Transcribing

1. Play any video or audio stream in Chrome.
2. Click the **Whisper Transcriber** extension icon and click **Start Recording**.
3. Speech is continuously appended to `chrome-whisper-transcriber/transcript.txt`.
