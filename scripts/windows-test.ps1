# Real-Windows test of the released LycheeWave build (used by .github/workflows/windows-test.yml)
param([string]$Rel = 'rel', [string]$Out = 'wt')
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out, "$Out/screenshots" | Out-Null
$Out = (Resolve-Path $Out).Path; $Rel = (Resolve-Path $Rel).Path
$results = [System.Collections.ArrayList]::new()
function Step($name, [scriptblock]$fn) {
  Write-Host "=== $name"
  try { $d = & $fn | Out-String; $null = $results.Add([pscustomobject]@{ test = $name; ok = $true; detail = $d.Trim() }) }
  catch { $null = $results.Add([pscustomobject]@{ test = $name; ok = $false; detail = "$_" }) }
  Write-Host ($results[-1] | Format-List | Out-String)
}
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
function Shot($file) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $seen = @{}; for ($x = 40; $x -lt [Math]::Min(1000, $b.Width); $x += 23) { for ($y = 80; $y -lt [Math]::Min(680, $b.Height); $y += 19) { $seen[$bmp.GetPixel($x, $y).ToArgb()] = 1 } }
  $g.Dispose(); $bmp.Dispose(); return $seen.Count
}
function UninstEntry { Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -like 'LycheeWave*' }
function SelfTest($exe, $tag) {
  $o = "$Out/selftest-$tag.txt"
  $p = Start-Process $exe -ArgumentList '--lw-selftest', "`"$media`"" -RedirectStandardOutput $o -RedirectStandardError "$Out/selftest-$tag.err.txt" -PassThru -Wait
  $line = Get-Content $o | Where-Object { $_ -like 'LW_SELFTEST_JSON *' } | Select-Object -Last 1
  if (-not $line) { throw "no LW_SELFTEST_JSON (exit $($p.ExitCode))" }
  $j = $line.Substring(17) | ConvertFrom-Json
  $j.results | ForEach-Object { '{0} {1} — {2}' -f ($(if ($_.ok) { 'PASS' } else { 'FAIL' })), $_.name, $_.detail }
  $fail = @($j.results | Where-Object { -not $_.ok -and $_.name -ne 'data dir 0700 / files 0600' })
  "version $($j.version), packaged $($j.packaged), exit $($p.ExitCode), $(@($j.results | ? ok).Count)/$($j.results.Count) pass"
  if ($fail.Count) { throw "failed: " + ($fail.name -join '; ') }
}

Step 'Windows version' {
  $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
  "$($cv.ProductName) $($cv.DisplayVersion) build $($cv.CurrentBuild).$($cv.UBR) ($((Get-CimInstance Win32_OperatingSystem).Caption))"
}
Step 'SHA-256 matches SHA256SUMS.txt' {
  $sums = @{}; Get-Content "$Rel/SHA256SUMS.txt" | ForEach-Object { $h, $n = $_ -split '\s+', 2; $sums[$n.Trim()] = $h }
  Get-ChildItem $Rel -Filter '*win-x64*' | ForEach-Object {
    $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    if ($sums[$_.Name] -ne $h) { throw "$($_.Name): $h != $($sums[$_.Name])" }; "$($_.Name) $h OK"
  }
}
# test media: jfk.wav reused for the 16 kHz + meeting paths; hostile file name restored here
$media = "$env:RUNNER_TEMP\lwmedia"; New-Item -ItemType Directory -Force $media | Out-Null
foreach ($n in 'jfk.wav', 'zh16k.wav', 'meeting16k.wav') { Copy-Item test/media/jfk.wav "$media/$n" }
Copy-Item -LiteralPath test/media/hostile.mp3 -Destination (Join-Path $media '$(touch PWNED);-y `id`.mp3')
if (-not (Test-Path -LiteralPath (Join-Path $media '$(touch PWNED);-y `id`.mp3'))) { throw 'hostile test file not staged' }

$setup = (Get-ChildItem $Rel -Filter '*setup.exe').FullName
Step 'Silent install (NSIS /S)' {
  $p = Start-Process $setup -ArgumentList '/S' -PassThru -Wait; Start-Sleep 3
  $u = UninstEntry; if (-not $u) { throw "no uninstall registry entry (exit $($p.ExitCode))" }
  $script:instDir = $u.InstallLocation; if (-not $instDir) { $script:instDir = Split-Path ($u.UninstallString -replace '"', '' -replace ' /.*$', '') }
  $script:exe = Join-Path $instDir 'LycheeWave.exe'; if (-not (Test-Path $exe)) { throw "missing $exe" }
  $lnk = Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs" -Recurse -Filter 'LycheeWave*.lnk' -ErrorAction SilentlyContinue
  if (-not $lnk) { throw 'no Start Menu shortcut' }
  "exit $($p.ExitCode); dir $instDir; uninstall: $($u.UninstallString); version $($u.DisplayVersion); start menu: $($lnk.FullName -join ', ')"
}
Step 'Packaged self-test (installed)' { SelfTest $exe 'installed' }
Step 'Bundled whisper-cli.exe transcribes jfk.wav' {
  $bin = Join-Path $instDir 'resources\bin\whisper-cli.exe'; $model = Join-Path $instDir 'resources\models\ggml-base-q5_1.bin'
  $txt = & $bin -m $model -f "$media\jfk.wav" -l en -nt 2> "$Out/whisper.err.txt" | Out-String
  $txt | Set-Content "$Out/whisper-jfk.txt"
  if ($txt -notmatch 'ask not what your country can do for you') { throw "unexpected: $txt" }; $txt.Trim()
}
$cfgDir = "$env:APPDATA\LycheeWave"
foreach ($lang in 'zh-CN', 'en', 'ja') {
  Step "GUI launch + screenshot ($lang)" {
    New-Item -ItemType Directory -Force $cfgDir | Out-Null
    $f = "$cfgDir\settings.json"; $s = @{}; if (Test-Path $f) { $s = Get-Content $f -Raw | ConvertFrom-Json -AsHashtable }
    $s['uiLang'] = $lang; $s | ConvertTo-Json | Set-Content $f -Encoding utf8
    $p = Start-Process $exe -PassThru; Start-Sleep 15
    if ($p.HasExited) { throw "exited early: $($p.ExitCode)" }
    $png = "$Out/screenshots/win-$lang.png"; $colors = Shot $png
    $title = (Get-Process -Id $p.Id).MainWindowTitle
    Get-Process LycheeWave -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
    if ($colors -lt 8) { throw "window looks blank ($colors colours sampled)" }; "running OK, window title '$title', $colors colours sampled, $png"
  }
}
Step 'GUI diagnostics (Chromium log, --disable-gpu)' {
  foreach ($v in @(@{ n = 'default'; a = @('--enable-logging=stderr', '--v=0') }, @{ n = 'disable-gpu'; a = @('--enable-logging=stderr', '--v=0', '--disable-gpu') })) {
    $p = Start-Process $exe -ArgumentList $v.a -RedirectStandardError "$Out/gui-$($v.n).log" -RedirectStandardOutput "$Out/gui-$($v.n).out" -PassThru; Start-Sleep 15
    $null = Shot "$Out/screenshots/diag-$($v.n).png"; Get-Process LycheeWave -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
    "$($v.n): " + ((Get-Content "$Out/gui-$($v.n).log" -ErrorAction SilentlyContinue | Select-String -Pattern 'CONSOLE|ERROR|GPU|crash' | Select-Object -First 12) -join ' // ')
  }
}
Step 'Portable zip: launch + self-test' {
  $z = "$env:RUNNER_TEMP\lwzip"; Expand-Archive (Get-ChildItem $Rel -Filter '*.zip').FullName $z -Force
  $zexe = Join-Path $z 'LycheeWave.exe'; $p = Start-Process $zexe -PassThru; Start-Sleep 12
  if ($p.HasExited) { throw "zip build exited early: $($p.ExitCode)" }
  $c = Shot "$Out/screenshots/win-portable.png"; if ($c -lt 8) { throw "portable window looks blank" }; Get-Process LycheeWave -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
  SelfTest $zexe 'portable'
}
Step 'Silent uninstall + cleanup' {
  $u = UninstEntry; $un = ($u.UninstallString -replace '"', '' -replace ' /.*$', '')
  $p = Start-Process $un -ArgumentList '/S' -PassThru -Wait; Start-Sleep 8
  $left = @(); if (Test-Path $exe) { $left += $exe }; if (UninstEntry) { $left += 'registry entry' }
  if (Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Recurse -Filter 'LycheeWave*.lnk' -ErrorAction SilentlyContinue) { $left += 'start menu shortcut' }
  if ($left) { throw "left behind: $($left -join ', ')" }
  "exit $($p.ExitCode); program files, registry entry, shortcut removed; user data dir kept: $(Test-Path $cfgDir)"
}
$results | ConvertTo-Json -Depth 4 | Set-Content "$Out/results.json"
$md = "| Test | Result | Detail |`n|---|---|---|`n" + (($results | ForEach-Object { "| $($_.test) | $(if ($_.ok) { 'PASS' } else { 'FAIL' }) | $(($_.detail -replace '\r?\n', '<br>' -replace '\|', '/').Substring(0, [Math]::Min(600, ($_.detail -replace '\r?\n', '<br>').Length))) |" }) -join "`n")
$md | Set-Content "$Out/results.md"; if ($env:GITHUB_STEP_SUMMARY) { $md | Add-Content $env:GITHUB_STEP_SUMMARY }
if ($results | Where-Object { -not $_.ok }) { exit 1 }
