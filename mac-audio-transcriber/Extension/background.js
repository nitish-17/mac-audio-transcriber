async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Recording tab audio and playing it back'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    (async () => {
      const { recordingState = 'idle' } = await chrome.storage.session.get('recordingState');
      if (recordingState !== 'idle') {
        sendResponse({ success: false, error: 'Already recording or starting' });
        return;
      }

      await chrome.storage.session.set({ recordingState: 'starting' });
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error('No active tab');

        const streamId = await new Promise((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!id) {
              reject(new Error('Failed to get stream ID'));
            } else {
              resolve(id);
            }
          });
        });

        await ensureOffscreenDocument();

        const offscreenResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'START_OFFSCREEN_RECORDING',
            streamId: streamId
          }, resolve);
        });

        if (offscreenResponse && offscreenResponse.success) {
          await chrome.storage.session.set({ recordingState: 'recording' });
          await chrome.action.setBadgeText({ text: 'REC' });
          await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
          sendResponse({ success: true });
        } else {
          await chrome.storage.session.set({ recordingState: 'idle' });
          try { await chrome.offscreen.closeDocument(); } catch (e) { /* already closed */ }
          sendResponse({ success: false, error: offscreenResponse?.error || 'Failed to start offscreen recording' });
        }
      } catch (err) {
        await chrome.storage.session.set({ recordingState: 'idle' });
        try { await chrome.offscreen.closeDocument(); } catch (e) { /* already closed */ }
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'STOP_RECORDING') {
    (async () => {
      const { recordingState = 'idle' } = await chrome.storage.session.get('recordingState');
      if (recordingState !== 'recording') {
        sendResponse({ success: false, error: 'Not recording' });
        return;
      }

      await chrome.storage.session.set({ recordingState: 'stopping' });
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_RECORDING' }, resolve);
        });

        await chrome.storage.session.set({ recordingState: 'idle' });
        await chrome.action.setBadgeText({ text: '' });

        try { await chrome.offscreen.closeDocument(); } catch (e) { /* already closed */ }
        sendResponse({ success: true });
      } catch (err) {
        await chrome.storage.session.set({ recordingState: 'idle' });
        await chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Live text preview from offscreen document
  if (message.type === 'TRANSCRIPT_UPDATE') {
    chrome.storage.session.set({ liveText: message.text });
  }
});
