param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -notmatch '^\d+(\.\d+){0,3}$') { throw 'Invalid extension version.' }

# An explicit allowlist prevents tests, browser screenshots and local dependencies
# from being shipped with the extension. All manifest references must be included.
$files = @('manifest.json', 'background.js', 'content.js', 'core.js', 'page-bridge.js',
  'popup.html', 'popup.js', 'popup.css', 'sidebar.css', 'LICENSE', 'PRIVACY_POLICY.md')
$files += $manifest.icons.PSObject.Properties.Value
$files += $manifest.action.default_icon.PSObject.Properties.Value
$files += $manifest.web_accessible_resources.resources
$files = @($files | Sort-Object -Unique)

$required = @($manifest.background.service_worker, $manifest.action.default_popup)
foreach ($script in $manifest.content_scripts) { $required += $script.js; $required += $script.css }
foreach ($name in $required) {
  if ($name -and $name -notin $files) { throw "Manifest reference missing from package: $name" }
}
foreach ($name in $files) {
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $name))
  if (-not $fullPath.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside project: $name" }
  $item = Get-Item -LiteralPath $fullPath
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular package file: $name" }
}

$outputDir = Join-Path $projectRoot 'dist'
[System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
$zipPath = Join-Path $outputDir "SideX-v$($manifest.version).zip"
# CreateNew intentionally refuses to overwrite an existing release artifact.
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
try {
  $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    foreach ($name in $files) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot $name), $name.Replace('\', '/'), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $archive.Dispose() }
} finally { $stream.Dispose() }

# Verify the actual archive without extracting temporary copies.
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if ($archive.Entries.Count -ne $files.Count -or -not $archive.GetEntry('manifest.json')) { throw 'Archive layout validation failed.' }
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName -notin $files) { throw "Unexpected archive entry: $($entry.FullName)" }
    $inputStream = $entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($inputStream)).Replace('-', '') }
    finally { $inputStream.Dispose(); $sha.Dispose() }
    $expected = (Get-FileHash -LiteralPath (Join-Path $projectRoot $entry.FullName) -Algorithm SHA256).Hash
    if ($actual -ne $expected) { throw "Archive content differs from source: $($entry.FullName)" }
  }
} finally { $archive.Dispose() }

[pscustomobject]@{
  Path = $zipPath
  Version = $manifest.version
  Files = $files.Count
  Bytes = (Get-Item -LiteralPath $zipPath).Length
  SHA256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
} | Format-List
