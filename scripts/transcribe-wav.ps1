param(
    [Parameter(Mandatory=$true)]
    [string]$WavPath
)

Add-Type -AssemblyName System.Speech
$stt = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$stt.LoadGrammar($grammar)

try {
    $stt.SetInputToWaveFile($WavPath)
    $results = New-Object System.Collections.Generic.List[string]
    while ($true) {
        $result = $stt.Recognize([System.TimeSpan]::FromSeconds(3))
        if ($null -eq $result) {
            break
        }
        if ($result.Text) {
            $results.Add($result.Text)
        }
    }
    if ($results.Count -gt 0) {
        Write-Output ($results -join " ")
    }
} catch {
    # If WAV format or stream end
} finally {
    $stt.Dispose()
}
