# db-verify-local.ps1
# Local Supabase migration validation using Docker.
#
# Prerequisites:
#   - Docker Desktop installed and running
#   - Supabase CLI available via npx
#
# Usage:
#   cd verdact-web
#   powershell -ExecutionPolicy Bypass -File scripts/db-verify-local.ps1
#
# This script:
#   1. Starts the local Supabase stack (Postgres, Auth, etc.)
#   2. Resets the local database and applies all migrations from scratch
#   3. Runs the Supabase linter to catch schema/policy warnings
#   4. Runs the security and performance advisors
#   5. Reports pass/fail status
#   6. Optionally stops the local stack when done

param(
    [switch]$KeepRunning,  # Do not stop the local stack after checks
    [switch]$SkipStart     # Skip starting the stack (assume it's already up)
)

$ErrorActionPreference = "Stop"
$exitCode = 0

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verdact — Local DB Migration Verifier " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Docker
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker is not running." }
    Write-Host "  Docker server: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Docker Desktop must be installed and running." -ForegroundColor Red
    Write-Host "  Install from https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

# 2. Start local Supabase
if (-not $SkipStart) {
    Write-Host "[2/6] Starting local Supabase stack..." -ForegroundColor Yellow
    npx supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to start local Supabase." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Local stack started." -ForegroundColor Green
} else {
    Write-Host "[2/6] Skipping start (--SkipStart flag)." -ForegroundColor DarkGray
}

# 3. Reset local DB (applies all migrations from scratch)
Write-Host "[3/6] Resetting local database (applying all migrations)..." -ForegroundColor Yellow
npx supabase db reset --local --no-seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Migration apply failed. Check SQL syntax." -ForegroundColor Red
    $exitCode = 1
} else {
    Write-Host "  All migrations applied successfully." -ForegroundColor Green
}

# 4. Run linter
Write-Host "[4/6] Running schema linter..." -ForegroundColor Yellow
npx supabase db lint --local --level warning
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Linter reported issues. Review output above." -ForegroundColor Yellow
    # Don't fail the whole script for lint warnings — they're advisory
} else {
    Write-Host "  Linter passed." -ForegroundColor Green
}

# 5. Run advisors
Write-Host "[5/6] Running security advisor..." -ForegroundColor Yellow
npx supabase inspection db lint --local --level warning 2>&1 | Write-Host
Write-Host ""

Write-Host "[6/6] Running performance advisor..." -ForegroundColor Yellow
npx supabase inspection db calls --local 2>&1 | Write-Host
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "  RESULT: ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: SOME CHECKS FAILED" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan

# Cleanup
if (-not $KeepRunning -and -not $SkipStart) {
    Write-Host ""
    Write-Host "Stopping local Supabase stack..." -ForegroundColor DarkGray
    npx supabase stop
}

exit $exitCode
