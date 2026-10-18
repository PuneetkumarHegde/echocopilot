const { execSync } = require('child_process');
const fs = require('fs');

console.log('Testing Windows Native Speech Recognizer capabilities...');

const psScript = `
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$engine.LoadGrammar($grammar)
Write-Output "Grammar loaded successfully. MaxAlternates: $($engine.MaxAlternates)"
`;

fs.writeFileSync('scripts/test-sapi.ps1', psScript);

try {
  const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-sapi.ps1', { encoding: 'utf8' });
  console.log('Output:\n', out);
} catch (err) {
  console.error('Error:', err.message);
}
