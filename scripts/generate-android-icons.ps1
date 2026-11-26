# Generate Android launcher icons + splash screens from public/icon-512.png
# Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-android-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = [System.Drawing.Image]::FromFile((Join-Path $root "public\icon-512.png"))
$res = Join-Path $root "android\app\src\main\res"

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @($bmp, $g)
}

function Save-Icon([int]$size, [double]$scale, [string]$path, [bool]$round, [bool]$whiteBg) {
  $c = New-Canvas $size $size; $bmp = $c[0]; $g = $c[1]
  $g.Clear([System.Drawing.Color]::Transparent)
  if ($round) {
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddEllipse(0, 0, $size, $size)
    $g.SetClip($gp)
    $g.Clear([System.Drawing.Color]::White)
  } elseif ($whiteBg) {
    $g.Clear([System.Drawing.Color]::White)
  }
  $d = [int][Math]::Round($size * $scale)
  $o = [int][Math]::Round(($size - $d) / 2.0)
  $g.DrawImage($src, $o, $o, $d, $d)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$densities = @{ "mdpi" = 1.0; "hdpi" = 1.5; "xhdpi" = 2.0; "xxhdpi" = 3.0; "xxxhdpi" = 4.0 }
foreach ($k in $densities.Keys) {
  $f = $densities[$k]; $dir = Join-Path $res "mipmap-$k"
  # Legacy square + round icons (48dp)
  Save-Icon ([int](48 * $f)) 1.0 (Join-Path $dir "ic_launcher.png") $false $true
  Save-Icon ([int](48 * $f)) 0.90 (Join-Path $dir "ic_launcher_round.png") $true $false
  # Adaptive foreground (108dp, logo kept comfortably within the 66dp safe zone)
  Save-Icon ([int](108 * $f)) 0.76 (Join-Path $dir "ic_launcher_foreground.png") $false $false
}

# Splash screens: white background, logo centered
Get-ChildItem $res -Recurse -Filter splash.png | ForEach-Object {
  $old = [System.Drawing.Image]::FromFile($_.FullName); $w = $old.Width; $h = $old.Height; $old.Dispose()
  $c = New-Canvas $w $h; $bmp = $c[0]; $g = $c[1]
  $g.Clear([System.Drawing.Color]::White)
  $d = [int]([Math]::Min($w, $h) * 0.55)
  $g.DrawImage($src, [int](($w - $d) / 2), [int](($h - $d) / 2), $d, $d)
  $bmp.Save($_.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$src.Dispose()
Write-Host "Android icons & splash generated from public/icon-512.png"
