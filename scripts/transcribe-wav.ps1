param(
    [Parameter(Mandatory=$true)]
    [string]$WavPath
)

Add-Type -AssemblyName System.Speech

# Find installed speech recognizer (prefers en-US / English)
$recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$selected = $recognizers | Where-Object { $_.CurrentLanguage.Name -like 'en*' } | Select-Object -First 1
if (-not $selected -and $recognizers.Count -gt 0) {
    $selected = $recognizers[0]
}

if ($selected) {
    $stt = New-Object System.Speech.Recognition.SpeechRecognitionEngine($selected.Id)
} else {
    $stt = New-Object System.Speech.Recognition.SpeechRecognitionEngine
}

$grammar = New-Object System.Speech.Recognition.DictationGrammar
$stt.LoadGrammar($grammar)

try {
    $stt.SetInputToWaveFile($WavPath)
    $results = New-Object System.Collections.Generic.List[string]
    while ($true) {
        try {
            $res = $stt.Recognize()
            if ($null -eq $res) { break }
            if ($res.Text) {
                $trimmed = $res.Text.Trim()
                if ($trimmed.Length -ge 2 -and ($null -eq $res.Confidence -or $res.Confidence -ge 0.20)) {
                    $results.Add($trimmed)
                }
            }
        } catch {
            # End of audio stream reached
            break
        }
    }
    if ($results.Count -gt 0) {
        Write-Output ($results -join " ")
    }
} catch {
    [Console]::Error.WriteLine("[transcribe-wav.ps1] SAPI Error: $($_.Exception.Message)")
} finally {
    $stt.Dispose()
}
