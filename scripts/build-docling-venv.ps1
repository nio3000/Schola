<#
.SYNOPSIS
  Phase 3-4-D-R2 POC: Build a bundled Python venv with docling + markitdown.
.DESCRIPTION
  Creates resources/runtimes/docling-venv/, installs docling/torch/markitdown,
  and generates runtime-manifest.json. Uses CPU-only torch.
  This script does NOT modify system Python or user site-packages.
.NOTES
  POC only — not run in CI. Requires Python 3.11 and pip on PATH.
  Run from project root: .\scripts\build-docling-venv.ps1
  On Windows, 'python3' may be a Microsoft Store App Execution Alias stub.
  Use 'python' or pass an explicit path: -PythonExe "C:\Path\To\python.exe"
#>
param(
  [string]$PythonExe = "python",
  [string]$RuntimesDir = "resources\runtimes",
  [string]$VenvName = "docling-venv"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSCommandPath | Split-Path -Parent
$VenvPath = Join-Path $RootDir "$RuntimesDir\$VenvName"

Write-Host "[D-R2] Building bundled Python venv at: $VenvPath"

# Step 0: Verify Python executable is functional
Write-Host "[D-R2] Checking Python: $PythonExe --version"
$versionOutput = & $PythonExe --version 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "Python executable '$PythonExe' is not available or not functional."
  Write-Error "On Windows, 'python3' may be a Microsoft Store App Execution Alias stub."
  Write-Error "Please specify a working Python: -PythonExe 'python' or -PythonExe 'C:\Path\To\python.exe'"
  exit 1
}
Write-Host "[D-R2] $versionOutput"

# Step 1: Create venv
if (Test-Path $VenvPath) {
  Write-Host "[D-R2] Removing existing venv..."
  Remove-Item -Recurse -Force $VenvPath
}
Write-Host "[D-R2] Creating venv with $PythonExe..."
& $PythonExe -m venv $VenvPath
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create venv"
}

$VenvPython = Join-Path $VenvPath "Scripts\python.exe"

# Step 2: Upgrade pip
Write-Host "[D-R2] Upgrading pip..."
& $VenvPython -m pip install --upgrade pip --quiet

# Step 3: Install docling + torch CPU
Write-Host "[D-R2] Installing docling + torch (CPU)..."
& $VenvPython -m pip install docling torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install docling/torch"
}

# Step 4: Install markitdown (shared venv)
Write-Host "[D-R2] Installing markitdown..."
& $VenvPython -m pip install markitdown --quiet
if ($LASTEXITCODE -ne 0) {
  Write-Host "[D-R2] WARNING: markitdown install failed (non-fatal)"
}

# Step 5: Collect versions for manifest
Write-Host "[D-R2] Collecting package versions..."
$PythonVersion = & $VenvPython --version 2>&1 | ForEach-Object { $_ -replace 'Python\s+', '' }
$DoclingVersion = & $VenvPython -c "from importlib.metadata import version; print(version('docling'))" 2>&1
$TorchVersion = & $VenvPython -c "from importlib.metadata import version; print(version('torch'))" 2>&1
$MarkitdownVersion = & $VenvPython -c "from importlib.metadata import version; print(version('markitdown'))" 2>&1

# Step 6: Generate runtime-manifest.json
$Manifest = @{
  runtimeId = "docling-bundled"
  schemaVersion = 1
  python = @{
    executable = "$VenvName/Scripts/python.exe"
    version = "$PythonVersion".Trim()
  }
  packages = @{
    docling = "$DoclingVersion".Trim()
    markitdown = "$MarkitdownVersion".Trim()
    torch = "$TorchVersion".Trim()
  }
  platform = "win32-x64"
  createdAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
  checksum = $null
}

$ManifestPath = Join-Path $RootDir "$RuntimesDir\runtime-manifest.json"
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8

Write-Host "[D-R2] Build complete."
Write-Host "  Venv: $VenvPath"
Write-Host "  Manifest: $ManifestPath"
Write-Host "  Python: $PythonVersion"
Write-Host "  Docling: $DoclingVersion"
Write-Host "  Torch: $TorchVersion"
Write-Host "  MarkItDown: $MarkitdownVersion"
