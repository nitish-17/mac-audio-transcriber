document.addEventListener('DOMContentLoaded', async () => {
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const errorMsg = document.getElementById('error-message');
    const livePreview = document.getElementById('live-preview');

    async function updateUI() {
        const data = await chrome.storage.session.get(['recordingState', 'liveText']);
        const recordingState = data.recordingState || 'idle';
        const liveText = data.liveText || '';

        statusIndicator.className = 'status-indicator ' + recordingState;

        if (recordingState === 'idle') {
            btnStart.style.display = 'block';
            btnStop.style.display = 'none';
            btnStart.disabled = false;
            statusText.textContent = 'Ready to record tab audio';
            livePreview.style.display = 'none';
        } else if (recordingState === 'recording') {
            btnStart.style.display = 'none';
            btnStop.style.display = 'block';
            btnStop.disabled = false;
            statusText.textContent = 'Recording...';
            livePreview.style.display = 'block';
            livePreview.textContent = liveText || 'Listening...';
        } else if (recordingState === 'starting') {
            btnStart.style.display = 'block';
            btnStart.disabled = true;
            statusText.textContent = 'Connecting...';
        } else if (recordingState === 'stopping') {
            btnStop.style.display = 'block';
            btnStop.disabled = true;
            statusText.textContent = 'Stopping...';
        }
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }

    function hideError() {
        errorMsg.style.display = 'none';
    }

    btnStart.addEventListener('click', () => {
        hideError();
        chrome.storage.session.set({ liveText: '' });
        chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (res) => {
            if (res && !res.success) showError(res.error);
            updateUI();
        });
    });

    btnStop.addEventListener('click', () => {
        hideError();
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
            if (res && !res.success) showError(res.error);
            updateUI();
        });
    });

    chrome.storage.session.onChanged.addListener((changes) => {
        if (changes.recordingState || changes.liveText) updateUI();
    });

    updateUI();
});
