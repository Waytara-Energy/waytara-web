<#
Adds the missing days of the work log to the shared workbook as new sheets (one sheet for each day, named by its date, oldest first), using Excel itself so
that everything already in the workbook (a person's own edits, formatting, extra sheets) is left exactly as it is. A day that already has a sheet is never
touched; only days BEFORE today are added (a day is finished before it goes in).

  powershell -File scripts\update-work-log-excel.ps1                          the usual run
  powershell -File scripts\update-work-log-excel.ps1 -Path other.xlsx -Today 2026-11-13   a test on a copy, pretending it is that day

Run `python scripts/work_log.py sync` first (it reads git and adds the commits to the CSV); the scheduled task does both.

If the workbook is open in Excel on this PC the sheets are added to that open workbook and it is saved; if not, it is opened out of sight, changed, saved and
closed. Nothing is ever deleted. The new sheet is a copy of the newest sheet (so it has the same header colours, column widths, frozen header and filter), with
its rows replaced by the day's.
#>
param(
  [string]$Path = "C:\Users\Admin\OneDrive - Waytara Energy LLP\1-Worklogs\work-log-all-days-2026-11-11.xlsx",
  [string]$Today = (Get-Date -Format "yyyy-MM-dd"),
  [string]$Repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $Path)) { throw "The workbook is not there: $Path" }

$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$env:PYTHONIOENCODING = "utf-8"
function Py([string[]]$a) { $o = & python -I (Join-Path $Repo "scripts\work_log.py") @a; if ($LASTEXITCODE -ne 0) { throw "work_log.py failed: $($a -join ' ')" }; ($o -join "`n") }

# (Windows PowerShell 5 hands a JSON array over as ONE object, so it is unrolled by hand; a day's rows stay as a list of rows)
$days = @((Py @("days") | ConvertFrom-Json) | ForEach-Object { $_ })
$wanted = @($days | Where-Object { $_ -lt $Today })
if ($wanted.Count -eq 0) { "No finished days in the log."; return }

# Excel: the open workbook if it is open here, else a hidden instance of our own
$excel = $null; $wb = $null; $ours = $false; $openedHere = $false
try { $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application") } catch { $excel = $null }
if ($excel) {
  foreach ($w in $excel.Workbooks) { if ($w.FullName -ieq (Resolve-Path -LiteralPath $Path).Path) { $wb = $w; break } }
}
if (-not $wb) {
  # not open in a running Excel: our own hidden instance (a person's open workbooks are not touched)
  $excel = New-Object -ComObject Excel.Application
  $ours = $true
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open((Resolve-Path -LiteralPath $Path).Path)
  $openedHere = $true
}
$added = @()
try {
  $have = @{}
  foreach ($ws in $wb.Worksheets) { $have[[string]$ws.Name] = $true }
  foreach ($day in $wanted) {
    if ($have.ContainsKey($day)) { continue }
    $rows = @((Py @("day", "--date", $day) | ConvertFrom-Json) | ForEach-Object { , $_ })
    $last = $wb.Worksheets.Item($wb.Worksheets.Count)
    $last.Copy([Type]::Missing, $last)                # a copy after the newest sheet: same look
    $sheet = $wb.Worksheets.Item($wb.Worksheets.Count)
    $sheet.Name = $day
    # clear the copied rows (everything below the header) and the old filter
    if ($sheet.AutoFilterMode) { $sheet.AutoFilterMode = $false }
    $used = $sheet.UsedRange
    $lastRow = $used.Row + $used.Rows.Count - 1
    if ($lastRow -ge 2) { $sheet.Range("A2:D$lastRow").Clear() | Out-Null }
    $n = $rows.Count
    if ($n -gt 0) {
      $body = $sheet.Range("A2:D$($n + 1)")
      $body.NumberFormat = "@"
      # cell by cell: a day has a few dozen rows, and this is the form Excel always accepts
      for ($i = 0; $i -lt $n; $i++) {
        $r = $i + 2
        $sheet.Cells.Item($r, 1).Value2 = [string]$day
        $sheet.Cells.Item($r, 2).Value2 = [string]$rows[$i][0]
        $sheet.Cells.Item($r, 3).Value2 = [string]$rows[$i][1]
        $sheet.Cells.Item($r, 4).Value2 = [string]$rows[$i][2]
      }
      # the body looks like the other days' (the cleared cells lose their format): wrapped text, top aligned
      $body.WrapText = $true
      $body.VerticalAlignment = -4160
      $sheet.Range("A1:D$($n + 1)").AutoFilter() | Out-Null
      $body.Rows.AutoFit() | Out-Null
    } else {
      $sheet.Range("A2").Value2 = "No work was recorded for this day."
    }
    $added += "$day ($n rows)"
  }
  if ($added.Count -gt 0) { $wb.Save() }
}
finally {
  if ($openedHere) { $wb.Close($false) | Out-Null }
  if ($ours -and $excel) { $excel.Quit() | Out-Null; [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
}
if ($added.Count -eq 0) { "Nothing to add: every finished day already has its sheet." } else { "Added: " + ($added -join ", ") }
