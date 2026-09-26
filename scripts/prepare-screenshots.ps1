# Extracts the images from a screenshots ZIP, in natural order (1, 2, ... 10),
# skipping macOS junk, and saves each as a JPEG whose longest side is at most
# 1600 px so the product page slideshow stays fast.
#   powershell -File prepare-screenshots.ps1 <zip> <outputDir>
param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$OutDir
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $entries = $zip.Entries | Where-Object {
    $_.FullName -match '\.(png|jpe?g|webp)$' -and
    $_.FullName -notmatch '__MACOSX' -and
    $_.Name -notlike '._*' -and $_.Length -gt 0
  }
  # Natural sort: "2.png" before "10.png".
  $sorted = $entries | Sort-Object { [regex]::Replace($_.FullName, '\d+', { param($m) $m.Value.PadLeft(8, '0') }) }

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

  $index = 0
  foreach ($entry in $sorted) {
    $index++
    $stream = $entry.Open()
    $memory = New-Object System.IO.MemoryStream
    $stream.CopyTo($memory); $stream.Dispose()
    $image = [System.Drawing.Image]::FromStream($memory)
    $scale = [Math]::Min(1.0, 1600 / [Math]::Max($image.Width, $image.Height))
    $width = [int][Math]::Round($image.Width * $scale)
    $height = [int][Math]::Round($image.Height * $scale)
    $canvas = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $width, $height)
    $target = Join-Path $OutDir ('{0:D2}.jpg' -f $index)
    $canvas.Save($target, $codec, $params)
    $graphics.Dispose(); $canvas.Dispose(); $image.Dispose(); $memory.Dispose()
  }
  Write-Output "$index"
} finally {
  $zip.Dispose()
}
