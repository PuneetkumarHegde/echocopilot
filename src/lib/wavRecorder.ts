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
 * with peak gain normalization for optimal speech recognition accuracy.
 */
export function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  // Peak normalization so speech is clean, loud and easily recognized by speech engines
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0.005 ? Math.min(6.0, 0.85 / peak) : 1.0;

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

  // Convert float to 16-bit signed PCM with normalized gain applied
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

import { recordPipelineDiagnostic } from './audioPipelineHelper';

export interface PcmStreamRecorderOptions {
  stream: MediaStream;
  source: 'mic' | 'meeting';
  onAudioChunk: (blob: Blob, source: 'mic' | 'meeting', utteranceId: string) => Promise<void> | void;
  onAudioLevel?: (level: number) => void;
  onReceivingAudio?: (receiving: boolean) => void;
  onSpeechStateChange?: (state: 'idle' | 'speaking' | 'flushing') => void;
  onError?: (err: Error) => void;
  silenceThresholdMs?: number; // default: 1100ms (500–1500ms)
  preRollMs?: number;          // default: 350ms (200–400ms)
  minUtteranceDurationSec?: number; // default: 0.35s
}

export interface PcmStreamRecorder {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  forceFlush: () => void;
}

/**
 * Attaches continuous PCM audio processing to a MediaStream and sends speech chunks
 */
export function startPcmStreamRecorder(options: PcmStreamRecorderOptions): PcmStreamRecorder {
  const { 
    stream, 
    source, 
    onAudioChunk, 
    onAudioLevel, 
    onReceivingAudio, 
    onSpeechStateChange,
    onError,
    silenceThresholdMs = 1100,
    preRollMs = 350,
    minUtteranceDurationSec = 0.35
  } = options;

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

  // Ensure AudioContext is actively running (not suspended by autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch((err) => console.warn('[WavRecorder] AudioContext resume error:', err));
  }
  audioCtx.onstatechange = () => {
    if (audioCtx.state === 'suspended' && !isPaused && !isStopped) {
      audioCtx.resume().catch(() => {});
    }
  };

  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Meter update loop
  const updateMeter = () => {
    if (isStopped) return;
    if (!isPaused) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, Math.round((avg / 128) * 100));
      if (onAudioLevel) onAudioLevel(level);
      if (level > 4 && onReceivingAudio) {
        onReceivingAudio(true);
      }
    } else {
      if (onAudioLevel) onAudioLevel(0);
    }
    animFrameId = requestAnimationFrame(updateMeter);
  };
  animFrameId = requestAnimationFrame(updateMeter);

  // Script processor node (2048 samples = 128ms at 16kHz for responsive low-latency speech detection)
  const bufferSize = 2048;
  const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

  // Zero gain node prevents audio feedback through speakers
  const silenceGain = audioCtx.createGain();
  silenceGain.gain.value = 0;
  sourceNode.connect(processor);
  processor.connect(silenceGain);
  silenceGain.connect(audioCtx.destination);

  const maxPreRollChunks = Math.max(2, Math.ceil(preRollMs / (bufferSize / 16)));
  let preRollChunks: Float32Array[] = [];
  let accumulatedChunks: Float32Array[] = [];
  let totalSamples = 0;
  let isSpeaking = false;
  let silenceSamples = 0;
  let isDrainingQueue = false;
  const chunkQueue: Array<{ blob: Blob; utteranceId: string }> = [];
  let noiseFloor = 0.0015;

  let lastDiagLog = 0;
  const firstTrack = stream.getAudioTracks()[0];
  if (firstTrack) {
    firstTrack.onended = () => {
      recordPipelineDiagnostic('audio_input', 'warn', `Audio track ended for source=${source}`, { label: firstTrack.label });
      if (onError) onError(new Error(`AUDIO_TRACK_DISCONNECTED: ${firstTrack.label || source}`));
    };
  }

  const tracks = stream.getAudioTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState }));
  console.log(`[WavRecorder] Started PCM stream recorder for source="${source}". SampleRate=${audioCtx.sampleRate}, preRollMs=${preRollMs}, silenceThresholdMs=${silenceThresholdMs}. Tracks:`, tracks);
  recordPipelineDiagnostic('audio_input', 'info', `Started PCM recorder for ${source}`, { tracks, preRollMs, silenceThresholdMs });

  const drainQueue = async () => {
    if (isDrainingQueue || chunkQueue.length === 0) return;
    isDrainingQueue = true;
    try {
      while (chunkQueue.length > 0) {
        const item = chunkQueue.shift();
        if (item) {
          await onAudioChunk(item.blob, source, item.utteranceId);
        }
      }
    } catch (err: unknown) {
      console.warn(`[WavRecorder] Error in onAudioChunk:`, err);
      if (onError && err instanceof Error) onError(err);
    } finally {
      isDrainingQueue = false;
      if (chunkQueue.length > 0) {
        drainQueue();
      }
    }
  };

  const flush = (force = false) => {
    const minSamples = Math.round(16000 * minUtteranceDurationSec);
    if (!force && (totalSamples < minSamples || accumulatedChunks.length === 0)) {
      console.log(`[WavRecorder] Flush discarded: duration=${(totalSamples/16000).toFixed(2)}s < ${minUtteranceDurationSec}s threshold, chunks=${accumulatedChunks.length}`);
      accumulatedChunks = [];
      totalSamples = 0;
      isSpeaking = false;
      silenceSamples = 0;
      onSpeechStateChange?.('idle');
      return;
    }

    if (accumulatedChunks.length === 0) return;

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of accumulatedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const chunkDuration = (totalSamples / 16000).toFixed(2);
    accumulatedChunks = [];
    totalSamples = 0;
    isSpeaking = false;
    silenceSamples = 0;
    onSpeechStateChange?.('flushing');

    const wavBlob = encodeWAV(merged, 16000);
    if (wavBlob.size < 1000) {
      console.log(`[WavRecorder] Flush discarded: WAV size ${wavBlob.size} bytes < 1000 bytes`);
      onSpeechStateChange?.('idle');
      return;
    }

    // Measure peak and audible quality
    let peak = 0;
    for (let i = 0; i < merged.length; i++) {
      const a = Math.abs(merged[i]);
      if (a > peak) peak = a;
    }

    const utteranceId = `utt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`[WavRecorder] Speech utterance ready (${utteranceId}): ${chunkDuration}s (${wavBlob.size} bytes), peak=${peak.toFixed(4)}, audibility=${peak >= 0.010 ? 'AUDIBLE' : 'FAINT'} for ${source}`);
    recordPipelineDiagnostic('speech_detection', 'success', `Utterance ready: ${chunkDuration}s (peak ${peak.toFixed(4)})`, { durationSec: chunkDuration, sizeBytes: wavBlob.size, peak, source }, utteranceId);

    // Enqueue chunk into bounded queue (max 25 items) to prevent memory leak while accommodating high STT latency
    if (chunkQueue.length >= 25) {
      console.warn(`[WavRecorder] Queue overflow (25 chunks pending), dropping oldest chunk to maintain real-time responsiveness`);
      recordPipelineDiagnostic('speech_detection', 'warn', 'Queue overflow: dropped oldest speech chunk', { queueSize: chunkQueue.length }, utteranceId);
      chunkQueue.shift();
    }
    chunkQueue.push({ blob: wavBlob, utteranceId });
    drainQueue();
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

    // Asymmetric noise floor tracking:
    if (!isSpeaking) {
      if (rms < noiseFloor) {
        noiseFloor = noiseFloor * 0.85 + rms * 0.15;
      } else {
        noiseFloor = Math.min(0.020, noiseFloor * 0.992 + rms * 0.008);
      }
    }

    // Adaptive speech detection thresholds:
    // Supports quiet, normal, and loud speech while rejecting continuous background noise
    const speechStartThreshold = Math.max(0.012, noiseFloor * 2.2);
    const speechContinueThreshold = Math.max(0.007, noiseFloor * 1.4);

    const now = Date.now();
    if (!isSpeaking) {
      if (rms >= speechStartThreshold) {
        console.log(`[WavRecorder] SPEECH_START: rms=${rms.toFixed(5)} >= threshold=${speechStartThreshold.toFixed(5)}, noiseFloor=${noiseFloor.toFixed(5)}`);
        isSpeaking = true;
        silenceSamples = 0;
        onSpeechStateChange?.('speaking');

        // Prepend rolling pre-roll buffer so the first syllable/word is never clipped
        accumulatedChunks = [...preRollChunks, pcm16k];
        totalSamples = accumulatedChunks.reduce((acc, c) => acc + c.length, 0);
        preRollChunks = [];
      } else {
        if (now - lastDiagLog > 4000) {
          lastDiagLog = now;
          console.log(`[WavRecorder] IDLE: rms=${rms.toFixed(5)}, noiseFloor=${noiseFloor.toFixed(5)}, startThreshold=${speechStartThreshold.toFixed(5)}`);
        }
        // Keep a rolling pre-roll buffer while idle (e.g. ~350ms)
        preRollChunks.push(pcm16k);
        if (preRollChunks.length > maxPreRollChunks) {
          preRollChunks.shift();
        }
      }
    } else {
      // While speaking: accumulate speech samples
      accumulatedChunks.push(pcm16k);
      totalSamples += pcm16k.length;

      if (rms >= speechContinueThreshold) {
        silenceSamples = 0;
      } else {
        silenceSamples += pcm16k.length;
      }

      if (now - lastDiagLog > 1500) {
        lastDiagLog = now;
        console.log(`[WavRecorder] SPEAKING: duration=${(totalSamples/16000).toFixed(2)}s, silence=${(silenceSamples/16000).toFixed(2)}s, rms=${rms.toFixed(5)}`);
      }

      // Configurable silence threshold (default 700ms, range 500–900ms)
      const silenceThresholdSamples = Math.round(16000 * (silenceThresholdMs / 1000));
      const minSpeechSamples = Math.round(16000 * minUtteranceDurationSec);

      if (totalSamples >= minSpeechSamples && silenceSamples >= silenceThresholdSamples) {
        console.log(`[WavRecorder] SILENCE_END: totalSamples=${totalSamples} (${(totalSamples/16000).toFixed(2)}s), silenceSamples=${silenceSamples} >= silenceThreshold. Flushing.`);
        flush();
      }
    }

    // Maximum speech chunk ceiling (15.0 seconds) allowing complete technical questions without premature truncation
    if (totalSamples >= 16000 * 15.0) {
      console.log(`[WavRecorder] MAX_CHUNK_CEILING reached: ${(totalSamples/16000).toFixed(2)}s. Flushing.`);
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
    isPaused: () => isPaused,
    forceFlush: () => {
      console.log('[WavRecorder] Manual force flush requested');
      flush(true);
    }
  };
}
