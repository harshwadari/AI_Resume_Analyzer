param(
    [ValidateSet('api', 'worker', 'beat')]
    [string]$Service = 'api',
    [ValidateRange(1024, 65535)]
    [int]$Port = 8001
)

$ErrorActionPreference = 'Stop'
$serviceDirectory = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $serviceDirectory
$pythonExecutable = Join-Path $serviceDirectory '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) {
    throw 'Create ai-service/.venv and install requirements.txt first.'
}
$environmentFile = Join-Path $serviceDirectory '.env'
if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw 'Create ai-service/.env from .env.example and configure it first.'
}
Get-Content -LiteralPath $environmentFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim().Trim('"').Trim("'"), 'Process')
    }
}
switch ($Service) {
    'api' { & $pythonExecutable -m uvicorn app.main:app --host 127.0.0.1 --port $Port }
    'worker' { & $pythonExecutable -m celery -A app.core.celery_app.celery worker -Q resume-processing --pool=threads --concurrency=2 --loglevel=INFO }
    'beat' { & $pythonExecutable -m celery -A app.core.celery_app.celery beat --loglevel=INFO }
}
exit $LASTEXITCODE
