param([string]$Src, [string]$Dst, [int]$Size = 320)
Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]82)
Get-ChildItem -Directory $Src | ForEach-Object {
  $png = Get-ChildItem $_.FullName -Filter 'screen.*' | Select-Object -First 1 -ExpandProperty FullName
  if (-not $png) { return }
  $img = [System.Drawing.Image]::FromFile($png)
  $side = [Math]::Min($img.Width, $img.Height)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $srcRect = New-Object System.Drawing.Rectangle ([int](($img.Width - $side) / 2)), ([int](($img.Height - $side) / 2)), $side, $side
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size), $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $out = Join-Path $Dst ($_.Name + '.jpg')
  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Output $_.Name
}
