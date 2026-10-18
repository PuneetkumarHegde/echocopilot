const fs = require('fs');
const { execSync } = require('child_process');

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return Buffer.from(buffer);
}

// Generate 1 second of 440Hz tone
const samples = new Float32Array(16000);
for (let i = 0; i < 16000; i++) {
  samples[i] = Math.sin(2 * Math.PI * 440 * (i / 16000)) * 0.5;
}

const wavBuf = encodeWAV(samples, 16000);
fs.writeFileSync('scripts/test_sine.wav', wavBuf);
console.log('Encoded WAV size:', wavBuf.length, 'bytes');

const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/transcribe-wav.ps1 -WavPath scripts/test_sine.wav`;
try {
  const res = execSync(psCmd, { encoding: 'utf8' });
  console.log('SAPI recognized tone cleanly without crashing (result should be empty):', JSON.stringify(res.trim()));
} catch (e) {
  console.error('Error:', e.message);
}
