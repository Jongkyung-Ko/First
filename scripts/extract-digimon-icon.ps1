Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\AI_PJT\Digitla_World_Image\DigiMon_Icon.png"
$outDir = "C:\AI_PJT\Digital_Wrold\images"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

function Test-NavyPixel {
    param([System.Drawing.Color]$Color)
    if ($Color.A -lt 16) { return $false }
    $lum = 0.299 * $Color.R + 0.587 * $Color.G + 0.114 * $Color.B
    if ($lum -gt 120) { return $false }
    if ($Color.B -lt $Color.R) { return $false }
    if ($Color.B -lt 40) { return $false }
    return $true
}

function Test-BackgroundPixel {
    param([System.Drawing.Color]$Color)
    if ($Color.A -lt 16) { return $true }
    $lum = 0.299 * $Color.R + 0.587 * $Color.G + 0.114 * $Color.B
    $neutral = [Math]::Abs($Color.R - $Color.G) -lt 20 -and [Math]::Abs($Color.G - $Color.B) -lt 20
    return ($lum -ge 170 -and $neutral) -or ($lum -ge 210)
}

function Find-IconOneBounds {
    param([System.Drawing.Bitmap]$Bitmap)

    $minX = 9999
    $minY = 9999
    $maxX = 0
    $maxY = 0

    for ($y = 92; $y -le 175; $y++) {
        for ($x = 93; $x -le 179; $x++) {
            $c = $Bitmap.GetPixel($x, $y)
            if (Test-NavyPixel $c) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($minX -eq 9999) { throw "ICON 1 pixels not found" }

    $pad = 12
    $w = $maxX - $minX + 1 + ($pad * 2)
    $h = $maxY - $minY + 1 + ($pad * 2)
    $side = [Math]::Max($w, $h)
    $cx = [int](($minX + $maxX) / 2)
    $cy = [int](($minY + $maxY) / 2)

    return @{
        Cx = $cx
        Cy = $cy
        Half = [int][Math]::Ceiling($side / 2.0) + 4
    }
}

function New-TransparentSquareCrop {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [int]$Cx,
        [int]$Cy,
        [int]$HalfSize
    )

    $x0 = $Cx - $HalfSize
    $y0 = $Cy - $HalfSize
    $size = $HalfSize * 2
    $crop = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($y = 0; $y -lt $size; $y++) {
        for ($x = 0; $x -lt $size; $x++) {
            $sx = $x0 + $x
            $sy = $y0 + $y
            if ($sx -lt 0 -or $sy -lt 0 -or $sx -ge $Bitmap.Width -or $sy -ge $Bitmap.Height) {
                $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                continue
            }
            $src = $Bitmap.GetPixel($sx, $sy)
            if (Test-BackgroundPixel $src) {
                $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
            elseif (Test-NavyPixel $src) {
                $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $src.R, $src.G, $src.B))
            }
            else {
                $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
    }

    return $crop
}

function Save-SquarePng {
    param(
        [System.Drawing.Image]$Image,
        [int]$Size,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $scale = [Math]::Min($Size / $Image.Width, $Size / $Image.Height) * 0.88
    $w = $Image.Width * $scale
    $h = $Image.Height * $scale
    $x = ($Size - $w) / 2.0
    $y = ($Size - $h) / 2.0
    $g.DrawImage($Image, $x, $y, $w, $h)
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$src = [System.Drawing.Bitmap]::FromFile($sourcePath)
$bounds = Find-IconOneBounds -Bitmap $src
Write-Output ("ICON 1 bounds center x={0} y={1} half={2}" -f $bounds.Cx, $bounds.Cy, $bounds.Half)

$icon = New-TransparentSquareCrop -Bitmap $src -Cx $bounds.Cx -Cy $bounds.Cy -HalfSize $bounds.Half
$src.Dispose()

$masterPath = Join-Path $outDir "digimon-icon.png"
Save-SquarePng -Image $icon -Size 128 -Path $masterPath

foreach ($size in @(32, 64, 256)) {
    Save-SquarePng -Image $icon -Size $size -Path (Join-Path $outDir ("digimon-icon-{0}.png" -f $size))
}

$icon.Dispose()
Write-Output "Saved ICON 1 to $outDir"
