param(
    [string]$WavPath = "debug_last_chunk.wav"
)

Add-Type -AssemblyName System.Speech

$stt = New-Object System.Speech.Recognition.SpeechRecognitionEngine

# Attach event handlers
Register-ObjectEvent -InputObject $stt -EventName "SpeechHypothesized" -Action {
    Write-Host "[HYPOTHESIS] $($EventArgs.Result.Text) (confidence: $($EventArgs.Result.Confidence))"
} | Out-Null

Register-ObjectEvent -InputObject $stt -EventName "SpeechRecognitionRejected" -Action {
    Write-Host "[REJECTED] Text: '$($EventArgs.Result.Text)' (confidence: $($EventArgs.Result.Confidence))"
} | Out-Null

Register-ObjectEvent -InputObject $stt -EventName "SpeechRecognized" -Action {
    Write-Host "[RECOGNIZED] Text: '$($EventArgs.Result.Text)' (confidence: $($EventArgs.Result.Confidence))"
} | Out-Null

$grammar = New-Object System.Speech.Recognition.DictationGrammar
$stt.LoadGrammar($grammar)

Write-Host "Analyzing WAV: $WavPath"
$bytes = [System.IO.File]::ReadAllBytes($WavPath)
$samples = New-Object int[] (($bytes.Length - 44) / 2)
$max = 0
$sumSquares = 0.0
for ($i = 0; $i -lt $samples.Length; $i++) {
    $s = [System.BitConverter]::ToInt16($bytes, 44 + $i * 2)
    $samples[$i] = $s
    $abs = [Math]::Abs($s)
    if ($abs -gt $max) { $max = $abs }
    $norm = $s / 32768.0
    $sumSquares += ($norm * $norm)
}
$rms = [Math]::Sqrt($sumSquares / $samples.Length)
Write-Host "Duration: $(($samples.Length / 16000.0).ToString('0.00'))s, Max Int16: $max, Peak Normalized: $(($max/32768.0).ToString('0.000')), RMS: $($rms.ToString('0.0000'))"

# Count zero crossings to estimate frequency
$zeroCrossings = 0
for ($i = 1; $i -lt $samples.Length; $i++) {
    if (($samples[$i] -ge 0 -and $samples[$i - 1] -lt 0) -or ($samples[$i] -lt 0 -and $samples[$i - 1] -ge 0)) {
        $zeroCrossings++
    }
}
$zcr = $zeroCrossings / ($samples.Length / 16000.0) / 2.0
Write-Host "Approx dominant frequency (Zero Crossings Rate): $([Math]::Round($zcr)) Hz"

$stt.SetInputToWaveFile($WavPath)
$res = $stt.Recognize()
if ($res) {
    Write-Host "Direct Recognize() result: '$($res.Text)' (confidence: $($res.Confidence))"
} else {
    Write-Host "Direct Recognize() returned null (no speech detected by SAPI)"
}
$stt.Dispose()
