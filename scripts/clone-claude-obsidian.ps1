# === claude-obsidian Clone Script ===
$RepoUrl  = "https://github.com/<owner>/claude-obsidian.git"   # <-- PASTE REAL URL HERE
$DevPath  = "C:\dev"
$RepoName = "claude-obsidian"
$RepoPath = Join-Path $DevPath $RepoName

# 1. Ensure C:\dev exists
if (-not (Test-Path $DevPath)) {
    New-Item -ItemType Directory -Path $DevPath | Out-Null
    Write-Host "Created $DevPath" -ForegroundColor Green
}

# 2. Guard: do not overwrite an existing clone
if (Test-Path $RepoPath) {
    Write-Host "FAILED: $RepoPath already exists. Delete it or rename before cloning." -ForegroundColor Red
    return
}

# 3. Clone into C:\dev
Set-Location $DevPath
git clone $RepoUrl $RepoName
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: git clone returned error code $LASTEXITCODE." -ForegroundColor Red
    return
}

# 4. Enter repo and verify agent wiring
Set-Location $RepoPath
Write-Host "`n=== Clone complete. Verifying structure ===" -ForegroundColor Cyan

$checks = @(".raw", "wiki", ".claude\agents")
foreach ($c in $checks) {
    if (Test-Path (Join-Path $RepoPath $c)) {
        Write-Host "OK  -> $c" -ForegroundColor Green
    } else {
        Write-Host "MISSING -> $c (wiki-ingest may not trigger)" -ForegroundColor Yellow
    }
}

Write-Host "`nNow run: claude" -ForegroundColor Cyan
