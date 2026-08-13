let audioContext = null;
let mediaStream = null;
let websocket = null;
let workletNode = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_OFFSCREEN_RECORDING') {
    startCapture(message.streamId).then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.action === 'STOP_OFFSCREEN_RECORDING') {
    stopCapture();
    sendResponse({ success: true });
    return true;
  }
});

async function startCapture(streamId) {
  try {
    stopCapture();

    // 1. Capture media stream from tab
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // 2. Setup AudioContext
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Play to local speakers so user hears the video audio normally
    source.connect(audioContext.destination);

    // 3. Load AudioWorklet for PCM resampling
    await audioContext.audioWorklet.addModule('processor.js');
    workletNode = new AudioWorkletNode(audioContext, 'pcm-resampler-processor');

    source.connect(workletNode);

    // Connect workletNode through a silent gain node to destination so Web Audio graph executes process()
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    workletNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    // 4. Connect WebSocket to local Whisper Python server
    websocket = new WebSocket('ws://127.0.0.1:8000');

    websocket.onopen = () => {
      console.log('WebSocket connected to local Whisper server (ws://127.0.0.1:8000)');
      chrome.runtime.sendMessage({
        action: 'OFFSCREEN_STATUS_CHANGE',
        isRecording: true,
        statusMessage: 'Transcribing tab audio...'
      });
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
      chrome.runtime.sendMessage({
        action: 'OFFSCREEN_STATUS_CHANGE',
        isRecording: false,
        statusMessage: 'WebSocket Connection Failed (Is server running?)'
      });
    };

    websocket.onclose = () => {
      console.log('WebSocket closed');
    };

    workletNode.port.onmessage = (event) => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(event.data);
      }
    };

  } catch (err) {
    console.error('Error starting tab capture in offscreen:', err);
    chrome.runtime.sendMessage({
      action: 'OFFSCREEN_STATUS_CHANGE',
      isRecording: false,
      statusMessage: `Capture Error: ${err.message}`
    });
  }
}

function stopCapture() {
  if (websocket) {
    if (websocket.readyState === WebSocket.OPEN) {
      try {
        websocket.send('STOP');
      } catch (e) {}
      websocket.close();
    }
    websocket = null;
  }

  if (workletNode) {
    try {
      workletNode.disconnect();
    } catch (e) {}
    workletNode = null;
  }

  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {}
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {}
    });
    mediaStream = null;
  }
}
