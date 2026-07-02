# Build candle-support snapshot via Yahoo chart API
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Out = Join-Path $Root "data\stock-strategy-candle-support.json"
$SUPPORT_TOL = 2.0
$ROLL_DAYS = 20
$RECENT_DAYS = 14
$LIMIT = 100
$DM_OK = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEC,0x9D,0xBC,0xEC,0xB9,0x98))
$DM_BAD = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEB,0xB6,0x88,0xEC,0x9D,0xBC,0xEC,0xB9,0x98))
$LBL_HAMMER = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEB,0xA7,0x9D,0xEC,0xB9,0x98,0xED,0x98,0x95))
$LBL_STAR = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEC,0x83,0x9B,0xEB,0xB3,0x84,0xED,0x98,0x95))
$LBL_ENGULF = [System.Text.Encoding]::UTF8.GetString([byte[]](0xEC,0x83,0x81,0xEC,0x8A,0xB9,0x20,0xEC,0x9E,0xA5,0xEC,0x95,0x85,0xED,0x98,0x95))
$SUP_ROLL = [System.Text.Encoding]::UTF8.GetString([byte[]](0x32,0x30,0xEC,0x9D,0xBC,0xEC,0xA0,0x80,0xEC,0xA0,0x90))

function Parse-Universe($py, $var) {
  $text = Get-Content $py -Raw -Encoding UTF8
  $i = $text.IndexOf("${var}:")
  if ($i -lt 0) { throw "missing $var" }
  $block = $text.Substring($i)
  $matches = [regex]::Matches($block, '\("([^"]+)",\s*"([^"]*)"\)')
  $out = @()
  foreach ($m in $matches) { $out += ,@($m.Groups[1].Value, $m.Groups[2].Value) }
  return $out | Select-Object -First $LIMIT
}

function Get-Sma($vals, $p) {
  $out = @( $null ) * $vals.Count
  for ($i = $p - 1; $i -lt $vals.Count; $i++) {
    $w = $vals[($i - $p + 1)..$i]
    if ($w -contains $null) { continue }
    $out[$i] = ($w | Measure-Object -Sum).Sum / $p
  }
  return $out
}

function Get-CandleParts($c) {
  $o,$h,$l,$cl = $c.open,$c.high,$c.low,$c.close
  if ($null -eq $o -or $null -eq $h -or $null -eq $l -or $null -eq $cl) { return $null }
  $range = $h - $l
  if ($range -le 0) { return $null }
  $body = [math]::Abs($cl - $o)
  if ($body -le 0) { return $null }
  return @{
    open=$o; high=$h; low=$l; close=$cl; body=$body
    lower=[math]::Min($o,$cl)-$l; upper=$h-[math]::Max($o,$cl)
    bullish=($cl -gt $o); bearish=($cl -lt $o)
  }
}

function Test-NearSupport($low, $ref) {
  if ($ref -le 0) { return $false }
  $band = $ref * ($SUPPORT_TOL / 100.0)
  return ($low -ge ($ref - $band)) -and ($low -le ($ref + $band))
}

function Get-RollingLow($candles, $end, $days) {
  $start = [math]::Max(0, $end - $days + 1)
  $lows = @()
  for ($j=$start; $j -le $end; $j++) { if ($null -ne $candles[$j].low) { $lows += $candles[$j].low } }
  if ($lows.Count -eq 0) { return $null }
  return ($lows | Measure-Object -Minimum).Minimum
}

function Get-Support($candles, $i, $sma20, $sma60) {
  $low = $candles[$i].low
  if ($null -eq $low) { return $null }
  $roll = Get-RollingLow $candles $i $ROLL_DAYS
  if ($null -ne $roll -and (Test-NearSupport $low $roll)) { return $SUP_ROLL }
  if ($null -ne $sma20[$i] -and (Test-NearSupport $low $sma20[$i])) { return "SMA20" }
  if ($null -ne $sma60[$i] -and (Test-NearSupport $low $sma60[$i])) { return "SMA60" }
  return $null
}

function Test-Hammer($c) {
  $p = Get-CandleParts $c
  if (-not $p) { return $false }
  return ($p.lower -ge $p.body*2) -and ($p.upper -le $p.body*0.5) -and ($p.lower -ge $p.upper)
}

function Test-Engulf($prev,$curr) {
  $p=Get-CandleParts $prev; $c=Get-CandleParts $curr
  if (-not $p -or -not $c -or -not $p.bearish -or -not $c.bullish) { return $false }
  return ($c.open -le $p.close) -and ($c.close -ge $p.open)
}

function Test-Morning($d0,$d1,$d2) {
  $p0=Get-CandleParts $d0; $p1=Get-CandleParts $d1; $p2=Get-CandleParts $d2
  if (-not $p0 -or -not $p1 -or -not $p2 -or -not $p0.bearish -or -not $p2.bullish) { return $false }
  if ($p1.body -gt $p0.body*0.55) { return $false }
  $mid = ($p0.open + $p0.close)/2
  return $p2.close -gt $mid
}

function Get-Candles($ticker) {
  $enc = [uri]::EscapeDataString($ticker)
  $url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + $enc + '?interval=1d&range=6mo'
  $r = Invoke-RestMethod -Uri $url -Headers @{"User-Agent"="DigitalWorld/1.0"}
  $res = $r.chart.result[0]
  $ts = $res.timestamp
  $q = $res.indicators.quote[0]
  $candles = @()
  for ($i=0; $i -lt $ts.Count; $i++) {
    $close = $q.close[$i]
    if ($null -eq $close) { continue }
    $d = [DateTimeOffset]::FromUnixTimeSeconds($ts[$i]).UtcDateTime.ToString("yyyy-MM-dd")
    $candles += ,[pscustomobject]@{
      time=$d
      open= if ($null -ne $q.open[$i]) { $q.open[$i] } else { $close }
      high= if ($null -ne $q.high[$i]) { $q.high[$i] } else { $close }
      low= if ($null -ne $q.low[$i]) { $q.low[$i] } else { $close }
      close=$close
    }
  }
  return $candles
}

function Get-PatternLabel($pat) {
  if ($pat -eq "hammer") { return $LBL_HAMMER }
  if ($pat -eq "morning_star") { return $LBL_STAR }
  return $LBL_ENGULF
}

function Detect-Signals($ticker,$name,$candles,$market,$currency) {
  if ($candles.Count -lt 62) { return @() }
  $closes = $candles | ForEach-Object { $_.close }
  $sma20 = Get-Sma $closes 20
  $sma60 = Get-Sma $closes 60
  $signals = @()
  for ($i=60; $i -lt $candles.Count; $i++) {
    $support = Get-Support $candles $i $sma20 $sma60
    if (-not $support) { continue }
    $patterns = @()
    if (Test-Hammer $candles[$i]) { $patterns += "hammer" }
    if ($i -ge 1 -and (Test-Engulf $candles[$i-1] $candles[$i])) { $patterns += "bullish_engulfing" }
    if ($i -ge 2 -and (Test-Morning $candles[$i-2] $candles[$i-1] $candles[$i])) { $patterns += "morning_star" }
    foreach ($pat in $patterns) {
      $prev = $candles[$i-1].close
      $close = $candles[$i].close
      if ($prev -eq 0) { continue }
      $pct = (($close/$prev)-1)*100
      if ($pct -eq 0) { continue }
      $sig = [ordered]@{
        market=$market; currency=$currency; pattern=$pat
        patternLabel=(Get-PatternLabel $pat)
        supportType=$support; ticker=$ticker; name=$name
        signalDate=$candles[$i].time; close=$close
        closePct=[math]::Round($pct,4); up=($pct -gt 0)
      }
      if ($null -ne $sma20[$i]) { $sig.sma20 = [math]::Round($sma20[$i],4) }
      if ($null -ne $sma60[$i]) { $sig.sma60 = [math]::Round($sma60[$i],4) }
      if ($i+1 -lt $candles.Count) {
        $n=$candles[$i+1].close
        if ($close -ne 0) {
          $ret=(($n/$close)-1)*100
          $sig.nextDate=$candles[$i+1].time; $sig.nextClose=$n
          $sig.dayReturnPct=[math]::Round($ret,4)
          $sig.directionMatch = if ($ret -gt 0) { $DM_OK } else { $DM_BAD }
        }
      }
      $signals += ,$sig
    }
  }
  return $signals
}

function Get-MatchStats($signals) {
  $match=0;$mismatch=0;$pending=0
  foreach ($s in $signals) {
    if ($s.directionMatch -eq $DM_OK) { $match++ }
    elseif ($s.directionMatch -eq $DM_BAD) { $mismatch++ }
    else { $pending++ }
  }
  $eval=$match+$mismatch
  $rate = if ($eval -gt 0) { [math]::Round(($match/$eval)*100,1) } else { $null }
  return @{ match=$match; mismatch=$mismatch; pending=$pending; total=$signals.Count; evaluated=$eval; ratePct=$rate }
}

function Scan-Market($universe,$marketId,$currency) {
  $all=@(); $ends=@()
  $n=0
  foreach ($pair in $universe) {
    $n++
    $ticker=$pair[0]; $name=$pair[1]
    Write-Host "  [$marketId] $n/$($universe.Count) $ticker"
    try {
      $c = Get-Candles $ticker
      if ($c.Count) { $ends += $c[-1].time }
      $all += Detect-Signals $ticker $name $c $marketId $currency
    } catch { Write-Warning "$ticker : $_" }
    Start-Sleep -Milliseconds 120
  }
  $analysis = if ($ends.Count) { ($ends | Sort-Object)[-1] } else { $null }
  $cutoff = (Get-Date).AddDays(-$RECENT_DAYS).ToString("yyyy-MM-dd")
  $active = @($all | Where-Object { $_.signalDate -eq $analysis })
  $recent = @($all | Where-Object { $_.signalDate -ge $cutoff })
  return @{
    id=$marketId; title="$($marketId.ToUpper()) TOP $LIMIT"
    analysisDate=$analysis; latestSignalDate=$analysis
    activeSignals=$active; activeDisplayDate=$analysis; activeIsFallback=$false
    recentSignals=$recent; activeCount=$active.Count; recentCount=$recent.Count
    recentDays=$RECENT_DAYS; matchStats=(Get-MatchStats $recent)
    universeSize=$universe.Count; currency=$currency
  }
}

$kospi = Parse-Universe (Join-Path $Root "backend\kr_market_universes.py") "KOSPI_TOP_100"
$kosdaq = Parse-Universe (Join-Path $Root "backend\kr_market_universes.py") "KOSDAQ_TOP_100"
$nasdaq = Parse-Universe (Join-Path $Root "backend\us_market_universes.py") "NASDAQ_TOP_100"
$nyse = Parse-Universe (Join-Path $Root "backend\us_market_universes.py") "NYSE_TOP_100"

Write-Host "Scanning candle-support..."
$markets = @{
  kospi = Scan-Market $kospi "kospi" "KRW"
  kosdaq = Scan-Market $kosdaq "kosdaq" "KRW"
  nasdaq = Scan-Market $nasdaq "nasdaq" "USD"
  nyse = Scan-Market $nyse "nyse" "USD"
}

$now = (Get-Date).ToUniversalTime().ToString("o")
$payload = [ordered]@{
  version=1; strategyId="candle-support"; source="snapshot"
  savedAt=$now; updatedAt=$now; updatedAtNy=$now
  displayTimezone="America/New_York"
  updateSchedule="KOSPI/KOSDAQ 18:00 KST, NASDAQ/NYSE 18:00 ET"
  universe="KOSPI/KOSDAQ/NASDAQ/NYSE TOP $LIMIT"
  strategy=@{ id="candle-support"; title="candle-support"; universe="TOP $LIMIT" }
  recentDays=$RECENT_DAYS; markets=$markets
  activeSignals=@($markets.kospi.activeSignals + $markets.kosdaq.activeSignals + $markets.nasdaq.activeSignals + $markets.nyse.activeSignals)
  activeCount=($markets.kospi.activeCount + $markets.kosdaq.activeCount + $markets.nasdaq.activeCount + $markets.nyse.activeCount)
  analysisDate=$markets.kospi.analysisDate
}

$json = $payload | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($Out, $json + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== 2W match rates ==="
foreach ($key in @("kospi","kosdaq","nasdaq","nyse")) {
  $st = $markets[$key].matchStats
  $rate = if ($null -ne $st.ratePct) { "$($st.ratePct)%" } else { "-" }
  Write-Host "$key : match=$($st.match) miss=$($st.mismatch) rate=$rate total=$($st.total) pending=$($st.pending)"
}
Write-Host "Wrote $Out"
