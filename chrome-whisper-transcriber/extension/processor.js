class AudioResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Downsample from input sampleRate (e.g. 48000Hz) to 16000Hz
    const ratio = sampleRate / this.targetSampleRate;
    const outputLength = Math.floor(channelData.length / ratio);

    if (outputLength <= 0) return true;

    const pcm16 = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = Math.floor(i * ratio);
      const sample = Math.max(-1, Math.min(1, channelData[inputIndex]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);

    return true;
  }
}

registerProcessor('pcm-resampler-processor', AudioResamplerProcessor);
