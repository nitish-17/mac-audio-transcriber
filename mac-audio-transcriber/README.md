# Mac Chrome Audio Transcriber 🎙️

A 100% local, private, on-device macOS CLI application and Chrome Extension (Manifest V3) that transcribes audio playing in any Chrome tab directly into a plain `.txt` file.

Designed to work cleanly even on DRM/HLS/stream-protected videos where direct video downloading is restricted.

---

## 🌟 Key Features

* **100% Private & On-Device**: Uses Apple's native `Speech` framework (`SFSpeechRecognizer`) with hardware acceleration (Apple Silicon ANE). No paid cloud APIs, no data sent to external servers.
* **Tab-Specific Capture**: Uses `chrome.tabCapture` to capture pure, raw PCM audio directly from the active Chrome tab (ignores microphone or system background sounds).
* **Live Streaming over WebSockets**: Audio is streamed in real-time to a local Swift server (`ws://localhost:8080`) via an offscreen document.
* **Long Video Support**: Automatically chains recognition sessions to transcribe long videos (30+ minutes) seamlessly.
* **Append-Only Output**: Continually saves recognized speech to `Server/transcript.txt` with session timestamps.

---

## 📋 Prerequisites

1. **macOS 13+** (Ventura or later).
2. **Dictation Enabled**: Go to **System Settings > Keyboard > Dictation** and toggle **On**.
3. **Google Chrome** browser.

---

## 🚀 Quick Start

### 1. Start the Swift Speech Server

Open your terminal and run:

```bash
cd Server
swift run
```

> **Note**: On the first run, macOS will prompt for Speech Recognition permission. Click **OK** to grant access.

### 2. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `Extension/` directory in this repository.

### 3. Start Transcribing!

1. Open any video or audio stream in Chrome.
2. Click the **Audio Transcriber** extension icon and click **Start Recording**.
3. Hear the video play as normal while the speech is transcribed live into `Server/transcript.txt`.

---

## 📁 Repository Structure

```
├── Extension/         # Manifest V3 Chrome Extension (tabCapture + AudioWorklet + WebSockets)
├── Server/            # Swift CLI Server (Network framework + SFSpeechRecognizer)
├── .gitignore
└── README.md
```

---

## 🛡️ Privacy

This tool runs 100% locally. Audio never leaves your computer and no third-party APIs are called.
