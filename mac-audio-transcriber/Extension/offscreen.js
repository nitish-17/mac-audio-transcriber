let audioCtx;
let ws;
let mediaStream;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_OFFSCREEN_RECORDING') {
        startRecording(message.streamId)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    if (message.type === 'STOP_OFFSCREEN_RECORDING') {
        stopRecording();
        sendResponse({ success: true });
    }
});

async function startRecording(streamId) {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        audioCtx = new AudioContext({ sampleRate: 16000 });
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        const source = audioCtx.createMediaStreamSource(mediaStream);

        // Load AudioWorklet processor
        await audioCtx.audioWorklet.addModule('processor.js');
        const processor = new AudioWorkletNode(audioCtx, 'pcm-extractor');

        // Connect WebSocket to the Swift server
        ws = new WebSocket('ws://localhost:8080');

        await new Promise((resolve, reject) => {
            ws.onopen = () => {
                console.log('[offscreen] WebSocket connected');
                resolve();
            };
            ws.onerror = () => reject(new Error('WebSocket connection failed. Ensure the Swift server is running on ws://localhost:8080'));
        });

        // Receive transcript updates from the server and forward to background
        ws.onmessage = (event) => {
            const text = typeof event.data === 'string' ? event.data : '';
            if (text) {
                chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: text });
            }
        };

        // Stream audio chunks from the worklet to the WebSocket
        processor.port.onmessage = (e) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(e.data);
            }
        };

        // Keep the processor alive by connecting it through a silent gain node
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Play the captured audio back to the user so they can hear the video
        source.connect(audioCtx.destination);
    } catch (err) {
        // Clean up resources immediately on failure so the tab is unmuted
        stopRecording();
        throw err;
    }
}

function stopRecording() {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
}
