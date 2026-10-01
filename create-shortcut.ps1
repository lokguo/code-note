# Creates a desktop shortcut that launches CodeNote directly via the
# bundled electron.exe (no terminal window, no npm needed at runtime).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'CodeNote.lnk'
$electronExe = Join-Path $here 'node_modules\electron\dist\electron.exe'

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = '"' + $here + '"'
$shortcut.WorkingDirectory = $here
$shortcut.IconLocation = Join-Path $here 'assets\icon.ico'
$shortcut.Description = 'Launch CodeNote (coding-style desktop sticky note)'
$shortcut.Save()

Write-Output "Shortcut created at: $shortcutPath"
