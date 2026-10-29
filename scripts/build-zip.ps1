# Builds the Chrome Web Store package: only the runtime files, entry names with "/" separators.
# (Windows PowerShell 5.1's Compress-Archive writes "fonts\fonts.css" entry names, which are not valid ZIP paths:
# some unzippers then treat the font files as odd file names in the root and the popup loses its fonts.)
#
#   powershell -File scripts\build-zip.ps1 [output.zip]      default output: <repo>\selectra-cws.zip
param([string]$Out)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
if (-not $Out) { $Out = Join-Path $root 'selectra-cws.zip' }
$Out = [System.IO.Path]::GetFullPath($Out)

# only these kinds of files ship: whatever the operating system or an editor leaves in a folder (.DS_Store, Thumbs.db, desktop.ini, *.swp) stays out
$allowed = @('.woff2', '.css', '.txt', '.html', '.js', '.json', '.png')
$files = @('manifest.json', 'background.js', 'shared.js', 'image-rules.js', 'image-engine.js', 'content.js', 'content-main.js',
           'popup.html', 'popup.js', 'popup.css', 'theme-init.js', 'i18n.js', 'icon16.png', 'icon48.png', 'icon128.png')
$files += Get-ChildItem -Path (Join-Path $root 'fonts') -File | Where-Object { $allowed -contains $_.Extension.ToLower() } | Sort-Object Name | ForEach-Object { "fonts/$($_.Name)" }
$files += Get-ChildItem -Path (Join-Path $root 'legal') -File | Where-Object { $allowed -contains $_.Extension.ToLower() } | Sort-Object Name | ForEach-Object { "legal/$($_.Name)" }
# _locales/<code>/messages.json: the store lists exactly these languages (one folder level deeper than fonts/ and legal/)
$files += Get-ChildItem -Path (Join-Path $root '_locales') -Recurse -File | Where-Object { $allowed -contains $_.Extension.ToLower() } | Sort-Object FullName | ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') }

foreach ($f in $files) { if (-not (Test-Path (Join-Path $root $f))) { throw "missing runtime file: $f" } }

if (Test-Path $Out) { Remove-Item $Out -Force }
$zip = [System.IO.Compression.ZipFile]::Open($Out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  # The same files always make the same zip, byte for byte: every entry carries one fixed time (the files' own times would differ from checkout to checkout),
  # so the package built from the source can be compared with the one that was uploaded by its SHA-256.
  $stamp = New-Object System.DateTimeOffset(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
  foreach ($f in $files) {
    $entry = $zip.CreateEntry($f, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $stamp
    $in = [System.IO.File]::OpenRead((Join-Path $root $f))
    $stream = $entry.Open()
    try { $in.CopyTo($stream) } finally { $stream.Dispose(); $in.Dispose() }
  }
} finally { $zip.Dispose() }

"{0}  {1} files  {2} KB" -f $Out, $files.Count, [math]::Round((Get-Item $Out).Length / 1KB)
