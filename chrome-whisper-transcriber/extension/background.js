let isRecording = false;
let statusMessage = "Idle";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_STATE') {
    sendResponse({ isRecording, statusMessage });
    return true;
  }

  if (message.action === 'START_RECORDING') {
    handleStartRecording().then((result) => sendResponse(result));
    return true;
  }

  if (message.action === 'STOP_RECORDING') {
    handleStopRecording().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === 'OFFSCREEN_STATUS_CHANGE') {
    isRecording = message.isRecording;
    statusMessage = message.statusMessage;
    sendResponse({ success: true });
    return true;
  }
});

async function handleStartRecording() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return { error: 'No active tab found' };
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

    // Create offscreen document if not existing
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capturing Chrome tab audio for whisper live transcription'
      });
    }

    // Send message to offscreen document
    await chrome.runtime.sendMessage({
      action: 'START_OFFSCREEN_RECORDING',
      streamId: streamId
    });

    isRecording = true;
    statusMessage = "Transcribing tab audio...";
    return { success: true };
  } catch (err) {
    console.error("Error starting recording:", err);
    isRecording = false;
    statusMessage = `Error: ${err.message}`;
    return { error: err.message };
  }
}

async function handleStopRecording() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      await chrome.runtime.sendMessage({ action: 'STOP_OFFSCREEN_RECORDING' });
      await chrome.offscreen.closeDocument();
    }

    isRecording = false;
    statusMessage = "Stopped";
  } catch (err) {
    console.error("Error stopping recording:", err);
  }
}
