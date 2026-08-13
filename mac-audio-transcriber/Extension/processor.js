class PCMExtractor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = [];
        this._bufferSize = 0;
        this._targetSize = 4096; // ~256ms at 16kHz
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            // Accumulate chunks until we have a meaningful amount
            this._buffer.push(new Float32Array(channelData));
            this._bufferSize += channelData.length;

            if (this._bufferSize >= this._targetSize) {
                const merged = new Float32Array(this._bufferSize);
                let offset = 0;
                for (const chunk of this._buffer) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }
                this.port.postMessage(merged.buffer, [merged.buffer]);
                this._buffer = [];
                this._bufferSize = 0;
            }
        }
        return true;
    }
}
registerProcessor('pcm-extractor', PCMExtractor);
