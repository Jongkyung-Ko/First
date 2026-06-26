Set-Location $PSScriptRoot

$log = Join-Path $PSScriptRoot "GIT_PUSH_RESULT.txt"
"=== GIT PUSH $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Encoding utf8

function Log($text) {
  $text | Tee-Object -FilePath $log -Append
}

Log ""
Log (git status -sb 2>&1 | Out-String)
Log ""
Log "=== git add -A ==="
git add -A 2>&1 | ForEach-Object { Log $_ }
Log ""
Log "=== git commit ==="
git commit -m @"
Add scheduled GitHub stock picks snapshots and instant static loading.

- GitHub Actions: KST/US Eastern 08:00 and 14:00 (4x daily)
- Static data/stock-picks.json for instant GitHub Pages load
- Frontend stale-while-revalidate with localStorage
"@ 2>&1 | ForEach-Object { Log $_ }
Log ""
Log "=== git push ==="
git push -u origin main 2>&1 | ForEach-Object { Log $_ }
Log ""
Log "COMMIT: $(git rev-parse HEAD 2>&1)"
Log "BRANCH: $(git branch --show-current 2>&1)"
Log "REMOTE: $(git remote get-url origin 2>&1)"
Log ""
Log "Done. Press Enter to close."
Read-Host
