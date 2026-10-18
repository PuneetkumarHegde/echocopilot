const { execSync } = require('child_process');
const fs = require('fs');

console.log('Testing SAPI TTS -> WAV -> SAPI STT loopback...');

const psScript = `
Add-Type -AssemblyName System.Speech

# 1. Synthesize a question into a WAV file using Windows SAPI TTS
$tts = New-Object System.Speech.Synthesis.SpeechSynthesizer
$wavPath = "$PSScriptRoot\\sample_question.wav"
$tts.SetOutputToWaveFile($wavPath)
$tts.Speak("How do you find the longest substring without repeating characters in Python?")
$tts.Dispose()

Write-Output "Synthesized test audio to: $wavPath (Size: $((Get-Item $wavPath).Length) bytes)"

# 2. Recognize the audio using Windows Speech Recognition Engine
$stt = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$stt.LoadGrammar($grammar)

$stt.SetInputToWaveFile($wavPath)
$result = $stt.Recognize([System.TimeSpan]::FromSeconds(10))

if ($result -ne $null) {
    Write-Output "RECOGNIZED TRANSCRIPT: $($result.Text)"
    Write-Output "CONFIDENCE: $($result.Confidence)"
} else {
    Write-Output "NO SPEECH RECOGNIZED"
}
$stt.Dispose()
`;

fs.writeFileSync('scripts/test-sapi-wav.ps1', psScript);

try {
  const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-sapi-wav.ps1', { encoding: 'utf8' });
  console.log(out);
} catch (err) {
  console.error('Error:', err.message);
}
