async function setState(isRecording, statusMessage) {
  await chrome.storage.local.set({ isRecording, statusMessage });
}

async function getState() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  const isOffscreenActive = existingContexts.length > 0;
  
  const data = await chrome.storage.local.get(['isRecording', 'statusMessage']);
  const isRecording = isOffscreenActive && (data.isRecording !== false);
  const statusMessage = data.statusMessage || (isRecording ? "Transcribing tab audio..." : "Idle");
  
  return { isRecording, statusMessage };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_STATE') {
    getState().then(sendResponse);
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
    setState(message.isRecording, message.statusMessage).then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleStartRecording() {
  try {
    await setState(false, "Connecting...");
    await closeOffscreenDocumentIfExisting();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      await setState(false, "No active tab found");
      return { error: 'No active tab found' };
    }

    let streamId;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    } catch (e) {
      console.warn("First getMediaStreamId attempt failed, retrying in 200ms...", e);
      await new Promise(r => setTimeout(r, 200));
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    }

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Capturing Chrome tab audio for whisper live transcription'
    });

    await chrome.runtime.sendMessage({
      action: 'START_OFFSCREEN_RECORDING',
      streamId: streamId
    });

    await setState(true, "Transcribing tab audio...");
    return { success: true };
  } catch (err) {
    console.error("Error starting recording:", err);
    await setState(false, `Error: ${err.message}`);
    return { error: err.message };
  }
}

async function handleStopRecording() {
  try {
    await closeOffscreenDocumentIfExisting();
    await setState(false, "Stopped");
  } catch (err) {
    console.error("Error stopping recording:", err);
  }
}

async function closeOffscreenDocumentIfExisting() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    try {
      await chrome.runtime.sendMessage({ action: 'STOP_OFFSCREEN_RECORDING' });
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {}
    await chrome.offscreen.closeDocument();
    await new Promise(r => setTimeout(r, 150));
  }
}
