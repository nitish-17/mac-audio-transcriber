document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  function updateUI(isRecording, text = '') {
    if (isRecording) {
      statusDot.className = 'dot recording';
      statusText.textContent = text || 'Transcribing tab audio...';
      toggleBtn.textContent = 'Stop Recording';
      toggleBtn.className = 'btn stop';
    } else {
      statusDot.className = 'dot disconnected';
      statusText.textContent = text || 'Idle / Not recording';
      toggleBtn.textContent = 'Start Recording';
      toggleBtn.className = 'btn start';
    }
  }

  // Fetch verified state from background
  const state = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
  if (state) {
    updateUI(state.isRecording, state.statusMessage);
  }

  // Listen for storage changes in real time
  chrome.storage.onChanged.addListener((changes) => {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }).then((currentState) => {
      if (currentState) {
        updateUI(currentState.isRecording, currentState.statusMessage);
      }
    });
  });

  toggleBtn.addEventListener('click', async () => {
    const currentState = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
    if (currentState && currentState.isRecording) {
      updateUI(false, 'Stopping...');
      await chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
      updateUI(false, 'Stopped');
    } else {
      updateUI(true, 'Connecting...');
      const startRes = await chrome.runtime.sendMessage({ action: 'START_RECORDING' });
      if (startRes && startRes.error) {
        updateUI(false, `Error: ${startRes.error}`);
      }
    }
  });
});
