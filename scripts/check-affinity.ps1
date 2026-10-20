param([Int64]$HwndVal)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinDisplay {
    [DllImport("user32.dll")]
    public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint pdwAffinity);
}
'@

[IntPtr]$hwnd = [IntPtr]$HwndVal
[uint32]$affinity = 0
$result = [WinDisplay]::GetWindowDisplayAffinity($hwnd, [ref]$affinity)
Write-Host "HWND: $HwndVal, Result: $result, Affinity: 0x$($affinity.ToString('X8')) ($affinity)"
