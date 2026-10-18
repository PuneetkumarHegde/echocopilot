const { execSync } = require('child_process');

try {
  const psCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Select-Object -ExpandProperty Description"`;
  const out = execSync(psCmd, { encoding: 'utf8' });
  console.log('Installed Windows Speech Recognizers:\n', out.trim());
} catch (e) {
  console.error('Error checking SAPI:', e.message);
}
