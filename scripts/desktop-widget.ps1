param(
    [string]$Action,
    [long]$Hwnd
)

$csharp = @'
using System;
using System.Runtime.InteropServices;

public class CodeNoteDesktopWidget
{
    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    // NOTE: We intentionally do NOT reparent the window into Explorer's
    // WorkerW (the classic Rainmeter-style "attach to desktop" trick).
    // Electron/Chromium windows use their own GPU compositor swap chain,
    // and reparenting them under WorkerW made the window stop rendering
    // entirely (it became invisible). Instead we just keep it at the
    // bottom of the normal top-level z-order, combined with mouse
    // click-through handled from the main process.
    public static string SendToBottom(IntPtr hwnd)
    {
        const uint SWP_NOSIZE = 0x0001;
        const uint SWP_NOMOVE = 0x0002;
        const uint SWP_NOACTIVATE = 0x0010;
        bool posOk = SetWindowPos(hwnd, new IntPtr(1) /* HWND_BOTTOM */, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
        return string.Format("setWindowPosOk={0}", posOk);
    }

    public static string BringToTop(IntPtr hwnd)
    {
        const uint SWP_NOSIZE = 0x0001;
        const uint SWP_NOMOVE = 0x0002;
        bool posOk = SetWindowPos(hwnd, IntPtr.Zero /* HWND_TOP */, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE);
        return string.Format("setWindowPosOk={0}", posOk);
    }
}
'@

Add-Type -TypeDefinition $csharp -Language CSharp

$hwndPtr = [IntPtr]$Hwnd

if ($Action -eq 'attach') {
    $res = [CodeNoteDesktopWidget]::SendToBottom($hwndPtr)
    Write-Output $res
} elseif ($Action -eq 'detach') {
    $res = [CodeNoteDesktopWidget]::BringToTop($hwndPtr)
    Write-Output $res
}
