param(
  [Parameter(Mandatory = $true)]
  [string]$PayloadPath,
  [string]$PrinterName = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function Convert-MmToHundredthsOfInch([double]$millimeters) {
  return [int][Math]::Round(($millimeters / 25.4) * 100)
}

function Resolve-TargetPrinterName([string]$ConfiguredPrinterName) {
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPrinterName)) {
    return $ConfiguredPrinterName
  }

  $printerSettings = New-Object System.Drawing.Printing.PrinterSettings
  return $printerSettings.PrinterName
}

function Get-DocumentText($document) {
  $text = [string]$document.text

  if ([string]::IsNullOrWhiteSpace($text)) {
    throw 'Documento sem conteudo de texto para impressao.'
  }

  return ($text -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd()
}

function New-ThermalPaperSize($documentText, [double]$widthMm, [single]$fontSizePt, [bool]$cutPaper) {
  $lineCount = @($documentText.Split("`n")).Count
  $extraLines = if ($cutPaper) { 4 } else { 1 }
  $estimatedHeight = [Math]::Max(220, [int](($lineCount + $extraLines) * ($fontSizePt * 2.6) + 36))
  $width = Convert-MmToHundredthsOfInch $widthMm

  return New-Object System.Drawing.Printing.PaperSize('NAVIA-Thermal', $width, $estimatedHeight)
}

function Print-ThermalDocument($document, [string]$targetPrinterName) {
  $text = Get-DocumentText $document
  $copies = if ($document.copies) { [Math]::Max(1, [int]$document.copies) } else { 1 }
  $widthMm = if ($document.widthMm) { [double]$document.widthMm } else { 58 }
  $cutPaper = $true

  if ($null -ne $document.cut) {
    $cutPaper = [bool]$document.cut
  }

  for ($copyIndex = 0; $copyIndex -lt $copies; $copyIndex += 1) {
    $printDocument = New-Object System.Drawing.Printing.PrintDocument
    $printDocument.PrinterSettings.PrinterName = $targetPrinterName

    if (-not $printDocument.PrinterSettings.IsValid) {
      throw "Impressora invalida: $targetPrinterName"
    }

    $fontSize = if ($widthMm -le 58) { 7.5 } else { 8.5 }
    $font = New-Object System.Drawing.Font('Consolas', $fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
    $lineHeight = [single]($font.GetHeight() + 0.5)
    $paperSize = New-ThermalPaperSize $text $widthMm $font.SizeInPoints $cutPaper
    $printDocument.DefaultPageSettings.PaperSize = $paperSize
    $printDocument.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(4, 4, 4, 4)

    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $text.Split("`n")) {
      [void]$lines.Add($line)
    }

    if ($cutPaper) {
      [void]$lines.Add('')
      [void]$lines.Add('')
      [void]$lines.Add('')
    }

    $currentLineIndex = 0
    $brush = [System.Drawing.Brushes]::Black

    $handler = [System.Drawing.Printing.PrintPageEventHandler]{
      param($sender, $eventArgs)

      $x = [single]$eventArgs.MarginBounds.Left
      $y = [single]$eventArgs.MarginBounds.Top

      while ($currentLineIndex -lt $lines.Count) {
        if (($y + $lineHeight) -gt $eventArgs.MarginBounds.Bottom) {
          $eventArgs.HasMorePages = $true
          return
        }

        $eventArgs.Graphics.DrawString($lines[$currentLineIndex], $font, $brush, $x, $y)
        $currentLineIndex += 1
        $y += $lineHeight
      }

      $eventArgs.HasMorePages = $false
    }

    $printDocument.add_PrintPage($handler)

    try {
      $printDocument.Print()
    } finally {
      $printDocument.remove_PrintPage($handler)
      $font.Dispose()
      $printDocument.Dispose()
    }
  }
}

$payload = Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json -Depth 20
$documents = @($payload.documents)

if ($documents.Count -eq 0) {
  throw 'Nenhum documento foi enviado para a fila de impressao.'
}

$targetPrinterName = Resolve-TargetPrinterName $PrinterName

if ([string]::IsNullOrWhiteSpace($targetPrinterName)) {
  throw 'Nenhuma impressora padrao do Windows foi encontrada.'
}

foreach ($document in $documents) {
  Print-ThermalDocument $document $targetPrinterName
}
