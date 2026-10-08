param(
    [ValidateRange(1024,65525)][int]$Port = 5173,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSCommandPath

function Find-PreviewTool($name, $fallback) {
    $found = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.Source }
    $bundled = Join-Path $env:USERPROFILE $fallback
    if (Test-Path -LiteralPath $bundled) { return $bundled }
    throw "$name is missing. Install Node.js and pnpm, then try again."
}

try {
    $nodeCommand = Find-PreviewTool 'node' '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    $env:PATH = (Split-Path -Parent $nodeCommand) + ';' + $env:PATH
    $viteEntry = Join-Path $projectDirectory 'node_modules\vite\bin\vite.js'
    if (!(Test-Path -LiteralPath $viteEntry)) {
        $pnpmCommand = Find-PreviewTool 'pnpm' '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
        Push-Location $projectDirectory
        try {
            & $pnpmCommand install --frozen-lockfile
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        } finally { Pop-Location }
    }
    $previewUrl = $null
    for ($previewPort = $Port; $previewPort -le ($Port + 10); $previewPort++) {
        $candidate = "http://127.0.0.1:$previewPort"
        try {
            $existing = Invoke-WebRequest "$candidate/src/StudioScreens.tsx" -UseBasicParsing -TimeoutSec 2
            if ($existing.Content.Contains('StudioShell')) { $previewUrl = $candidate; break }
        } catch {}
        if (Get-NetTCPConnection -LocalPort $previewPort -State Listen -ErrorAction SilentlyContinue) { continue }
        $logDirectory = Join-Path $projectDirectory '.preview'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $viteArguments = @('"' + $viteEntry + '"', '--host', '127.0.0.1', '--port', "$previewPort", '--strictPort')
        $server = Start-Process -FilePath $nodeCommand -ArgumentList $viteArguments -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'server.log') -RedirectStandardError (Join-Path $logDirectory 'server-error.log')
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 300
            if ($server.HasExited) { throw 'Preview server failed. Check .preview/server-error.log.' }
            try {
                $ready = Invoke-WebRequest "$candidate/src/StudioScreens.tsx" -UseBasicParsing -TimeoutSec 2
                if ($ready.Content.Contains('StudioShell')) { $previewUrl = $candidate; break }
            } catch {}
        }
        if ($previewUrl) { break }
        throw 'Preview startup timed out. Check .preview/server.log.'
    }
    if (!$previewUrl) { throw 'No free preview port in the requested range.' }
    Write-Host "Preview ready: $previewUrl"
    if (!$NoBrowser) { Start-Process $previewUrl }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
