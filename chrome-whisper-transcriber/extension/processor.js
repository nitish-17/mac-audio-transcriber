class AudioResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    self.targetSampleRate = 16000;
    self.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Use channel 0 (mono)
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Downsample from sampleRate (e.g. 48000Hz) to 16000Hz
    const ratio = sampleRate / self.targetSampleRate;
    const outputLength = Math.floor(channelData.length / ratio);

    const pcm16 = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, channelData[inputIndex]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    if (pcm16.length > 0) {
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-resampler-processor', AudioResamplerProcessor);
