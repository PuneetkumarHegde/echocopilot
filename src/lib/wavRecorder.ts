/**
 * Web Audio API PCM WAV recorder and encoder.
 * Captures clean 16kHz 16-bit mono WAV audio chunks directly from MediaStream
 * without relying on browser-specific cloud WebSpeech API or ffmpeg.
 */

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Downsamples Float32Array PCM from inputRate to outputRate (default: 16000Hz)
 */
export function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate = 16000): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Encodes Float32Array PCM samples into standard 16kHz 16-bit mono WAV Blob
 */
export function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert float to 16-bit signed PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export interface PcmStreamRecorderOptions {
  stream: MediaStream;
  source: 'mic' | 'meeting';
  onAudioChunk: (blob: Blob, source: 'mic' | 'meeting') => Promise<void> | void;
  onAudioLevel?: (level: number) => void;
  onReceivingAudio?: (receiving: boolean) => void;
  onError?: (err: Error) => void;
}

export interface PcmStreamRecorder {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
}

/**
 * Attaches continuous PCM audio processing to a MediaStream and sends speech chunks
 */
export function startPcmStreamRecorder(options: PcmStreamRecorderOptions): PcmStreamRecorder {
  const { stream, source, onAudioChunk, onAudioLevel, onReceivingAudio, onError } = options;

  let isPaused = false;
  let isStopped = false;
  let animFrameId: number | null = null;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let audioCtx: AudioContext;

  try {
    audioCtx = new AudioCtx({ sampleRate: 16000 });
  } catch {
    audioCtx = new AudioCtx();
  }

  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Meter update loop
  const updateMeter = () => {
    if (isStopped) return;
    if (!isPaused) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, Math.round((avg / 128) * 100));
      if (onAudioLevel) onAudioLevel(level);
      if (level > 2 && onReceivingAudio) {
        onReceivingAudio(true);
      }
    } else {
      if (onAudioLevel) onAudioLevel(0);
    }
    animFrameId = requestAnimationFrame(updateMeter);
  };
  animFrameId = requestAnimationFrame(updateMeter);

  // Script processor node (4096 samples = ~256ms at 16kHz)
  const bufferSize = 4096;
  const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

  // Zero gain node prevents audio feedback through speakers
  const silenceGain = audioCtx.createGain();
  silenceGain.gain.value = 0;
  sourceNode.connect(processor);
  processor.connect(silenceGain);
  silenceGain.connect(audioCtx.destination);

  let accumulatedChunks: Float32Array[] = [];
  let totalSamples = 0;
  let isSpeaking = false;
  let silenceSamples = 0;
  let isProcessingChunk = false;

  const flush = async () => {
    if (totalSamples < 16000 * 0.8 || accumulatedChunks.length === 0 || isProcessingChunk) {
      accumulatedChunks = [];
      totalSamples = 0;
      isSpeaking = false;
      silenceSamples = 0;
      return;
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of accumulatedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    accumulatedChunks = [];
    totalSamples = 0;
    isSpeaking = false;
    silenceSamples = 0;

    const wavBlob = encodeWAV(merged, 16000);
    if (wavBlob.size < 4000) return;

    isProcessingChunk = true;
    try {
      await onAudioChunk(wavBlob, source);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    } finally {
      isProcessingChunk = false;
    }
  };

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    if (isStopped || isPaused) return;

    const channelData = e.inputBuffer.getChannelData(0);
    const pcm16k = audioCtx.sampleRate === 16000
      ? new Float32Array(channelData)
      : downsampleBuffer(channelData, audioCtx.sampleRate, 16000);

    // Calculate energy (RMS)
    let sum = 0;
    for (let i = 0; i < pcm16k.length; i++) {
      sum += pcm16k[i] * pcm16k[i];
    }
    const rms = Math.sqrt(sum / pcm16k.length);
    const isLoud = rms > 0.007;

    if (isLoud) {
      isSpeaking = true;
      silenceSamples = 0;
      accumulatedChunks.push(pcm16k);
      totalSamples += pcm16k.length;
    } else if (isSpeaking) {
      accumulatedChunks.push(pcm16k);
      totalSamples += pcm16k.length;
      silenceSamples += pcm16k.length;

      // Silence duration check (approx 750ms silence after speech)
      const silenceThreshold = 16000 * 0.75;
      const minSpeechSamples = 16000 * 1.0;

      if (totalSamples >= minSpeechSamples && silenceSamples >= silenceThreshold) {
        flush();
      }
    }

    // Maximum speech duration ceiling (approx 5 seconds) to avoid delay
    if (totalSamples >= 16000 * 5.0) {
      flush();
    }
  };

  return {
    stop: () => {
      isStopped = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      try { processor.disconnect(); } catch {}
      try { silenceGain.disconnect(); } catch {}
      try { sourceNode.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      try { audioCtx.close(); } catch {}
    },
    pause: () => {
      isPaused = true;
      if (onAudioLevel) onAudioLevel(0);
    },
    resume: () => {
      isPaused = false;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    },
    isPaused: () => isPaused
  };
}
