Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left; public int Top; public int Right; public int Bottom;
    }
}
'@

$electronPids = (Get-Process -Name electron -ErrorAction SilentlyContinue).Id
$found = @()

[WinAPI]::EnumWindows({
    param($hwnd, $lparam)
    [uint32]$pid = 0
    [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid)
    if ($electronPids -contains $pid) {
        $rect = New-Object WinAPI+RECT
        [WinAPI]::GetWindowRect($hwnd, [ref]$rect)
        $w = $rect.Right - $rect.Left
        $h = $rect.Bottom - $rect.Top
        $vis = [WinAPI]::IsWindowVisible($hwnd)
        $sb = New-Object System.Text.StringBuilder 256
        [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
        $title = $sb.ToString()
        if ($w -gt 50 -and $h -gt 50) {
            Write-Output "HWND: $hwnd, PID: $pid, Visible: $vis, Title: '$title', Bounds: ($($rect.Left), $($rect.Top)) Size: ${w}x${h}"
            [WinAPI]::ShowWindow($hwnd, 9)
            [WinAPI]::SetForegroundWindow($hwnd)
        }
    }
    return $true
}, [IntPtr]::Zero)
