# Generates Haguruma launcher PNGs (PWA design) for all Android densities.
param(
	[string]$ResRoot = 'C:\Users\LorenzoCamuso\Desktop\personali\Haguruma\android\app\src\main\res'
)

Add-Type -AssemblyName System.Drawing

$bg = [System.Drawing.Color]::FromArgb(255, 0x0b, 0x0d, 0x11)
$amber = [System.Drawing.Color]::FromArgb(255, 0xf5, 0x9e, 0x0b)
$cyan = [System.Drawing.Color]::FromArgb(255, 0x38, 0xbd, 0xf8)

function Get-RoundedRectPath {
	param([float]$W, [float]$H, [float]$R)
	$path = New-Object System.Drawing.Drawing2D.GraphicsPath
	$path.AddArc(0, 0, $R * 2, $R * 2, 180, 90)
	$path.AddArc($W - $R * 2, 0, $R * 2, $R * 2, 270, 90)
	$path.AddArc($W - $R * 2, $H - $R * 2, $R * 2, $R * 2, 0, 90)
	$path.AddArc(0, $H - $R * 2, $R * 2, $R * 2, 90, 90)
	$path.CloseFigure()
	return $path
}

function New-HagurumaIcon {
	param(
		[int]$Size,
		[string]$OutFile,
		[ValidateSet('Square', 'Round', 'Foreground')][string]$Style
	)
	$bmp = New-Object System.Drawing.Bitmap($Size, $Size)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
	$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

	if ($Style -eq 'Square') {
		$radius = $Size * 0.21875
		$path = Get-RoundedRectPath -W $Size -H $Size -R $radius
		$brush = New-Object System.Drawing.SolidBrush($bg)
		$g.FillPath($brush, $path)
		$brush.Dispose()
		$path.Dispose()
	}
	elseif ($Style -eq 'Round') {
		$brush = New-Object System.Drawing.SolidBrush($bg)
		$g.FillEllipse($brush, 0, 0, $Size, $Size)
		$brush.Dispose()
	}

	$scale = if ($Style -eq 'Foreground') { 0.90 } else { 1.0 }
	$cx = [float]$Size / 2.0
	$ringR = $Size * 0.27083 * $scale
	$stroke = $Size * 0.07292 * $scale
	$innerR = $Size * 0.09375 * $scale

	$pen = New-Object System.Drawing.Pen($amber, $stroke)
	$pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
	$g.DrawEllipse($pen, $cx - $ringR, $cx - $ringR, $ringR * 2, $ringR * 2)
	$pen.Dispose()

	$inner = New-Object System.Drawing.SolidBrush($cyan)
	$g.FillEllipse($inner, $cx - $innerR, $cx - $innerR, $innerR * 2, $innerR * 2)
	$inner.Dispose()

	$g.Dispose()
	$dir = Split-Path -Parent $OutFile
	if (-not (Test-Path -LiteralPath $dir)) {
		New-Item -ItemType Directory -Path $dir -Force | Out-Null
	}
	$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
	$bmp.Dispose()
	Write-Host "OK $OutFile ($Size)"
}

$densities = @(
	@{ Name = 'mdpi'; Square = 48; Fg = 108 },
	@{ Name = 'hdpi'; Square = 72; Fg = 162 },
	@{ Name = 'xhdpi'; Square = 96; Fg = 216 },
	@{ Name = 'xxhdpi'; Square = 144; Fg = 324 },
	@{ Name = 'xxxhdpi'; Square = 192; Fg = 432 }
)

foreach ($d in $densities) {
	$dir = Join-Path $ResRoot ("mipmap-" + $d.Name)
	New-HagurumaIcon -Size $d.Square -OutFile (Join-Path $dir 'ic_launcher.png') -Style Square
	New-HagurumaIcon -Size $d.Square -OutFile (Join-Path $dir 'ic_launcher_round.png') -Style Round
	New-HagurumaIcon -Size $d.Fg -OutFile (Join-Path $dir 'ic_launcher_foreground.png') -Style Foreground
}

Write-Host 'Done.'
