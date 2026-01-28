# cgcut project environment setup script
Write-Host "🚀 cgcut Project Environment Setup" -ForegroundColor Green
Write-Host "=" * 40

# Check administrator permission
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[WARN] Warning: Running as administrator is recommended" -ForegroundColor Yellow
}

# Check Node.js
Write-Host "`n🔍 Checking Node.js..." -ForegroundColor Cyan
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVersion = $(node --version)
    Write-Host "[OK] Node.js $nodeVersion installed" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js not installed, skipping installation (please install manually)" -ForegroundColor Red
    Write-Host "[INFO] Visit https://nodejs.org/ to download and install Node.js LTS" -ForegroundColor Yellow
    Write-Host "[INFO] During installation, check 'Add to PATH'" -ForegroundColor Yellow
}

# Check npm
Write-Host "`n🔍 Checking NPM..." -ForegroundColor Cyan
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCheck) {
    $npmVersion = $(npm --version)
    Write-Host "[OK] NPM $npmVersion installed" -ForegroundColor Green
} else {
    Write-Host "[ERROR] NPM not installed, skipping installation (please install manually)" -ForegroundColor Red
}

# Check Python
Write-Host "`n🔍 Checking Python..." -ForegroundColor Cyan
$pythonCheck = python --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Python installed" -ForegroundColor Green
    $pythonOk = $true
} else {
    Write-Host "[ERROR] Python not installed" -ForegroundColor Red
    Write-Host "[INFO] Visit https://www.python.org/downloads/ to download and install Python 3.9+" -ForegroundColor Yellow
    $pythonOk = $false
}

# Check pip
Write-Host "`n🔍 Checking Pip..." -ForegroundColor Cyan
python -m pip --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Pip installed" -ForegroundColor Green
    $pipOk = $true
} else {
    Write-Host "[ERROR] Pip not installed" -ForegroundColor Red
    $pipOk = $false
}

# If all base environments are installed, install project dependencies
if ($nodeCheck -and $npmCheck -and $pythonOk -and $pipOk) {
    Write-Host "`n📦 Installing frontend dependencies..." -ForegroundColor Cyan
    try {
        Set-Location $PSScriptRoot
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Frontend dependencies installation failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] Frontend dependencies installation failed: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "`n🐍 Installing backend dependencies..." -ForegroundColor Cyan
    try {
        # Install CLIP service dependencies
        Set-Location "$PSScriptRoot\clip-service"
        Write-Host "   Installing CLIP service dependencies..." -ForegroundColor Gray
        
        if (Test-Path "venv") {
            Write-Host "   Cleaning old virtual environment..." -ForegroundColor Gray
            Remove-Item -Path "venv" -Recurse -Force
        }
        
        Write-Host "   Creating new Python virtual environment..." -ForegroundColor Gray
        python -m venv venv
        
        # Activate virtual environment and install dependencies
        $python_exe = "$PSScriptRoot\clip-service\venv\Scripts\python.exe"
        & $python_exe -m pip install --upgrade pip
        & $python_exe -m pip install -r requirements.txt
        Write-Host "[OK] CLIP service dependencies installed" -ForegroundColor Green
        
        # Install VLM service dependencies
        Set-Location "$PSScriptRoot\vlm-service"
        Write-Host "   Installing VLM service dependencies..." -ForegroundColor Gray
        & $python_exe -m pip install -r requirements.txt
        Write-Host "[OK] VLM service dependencies installed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Backend dependencies installation failed: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Check environment configuration file
    Set-Location $PSScriptRoot
    if (-not (Test-Path ".env")) {
        Write-Host "`n📝 Creating environment configuration file..." -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] Environment configuration file created, please enter your API key" -ForegroundColor Green
    }
} else {
    Write-Host "`n[WARN] Please install base environments (Node.js, npm, Python, pip) first, then run this script again" -ForegroundColor Yellow
}

Write-Host "`n🎊 Environment check completed!" -ForegroundColor Green
Write-Host "=" * 40
Write-Host "[INFO] Next steps:" -ForegroundColor Cyan
Write-Host "   1. Edit .env file to enter API key (visit https://open.bigmodel.cn/)" -ForegroundColor White
Write-Host "   2. Run start-all-services.bat to start all services" -ForegroundColor White
Write-Host "   3. Visit http://localhost:5173 to use the app" -ForegroundColor White
Write-Host ""
Write-Host "   All buttons connect to real API endpoints:" -ForegroundColor Cyan
Write-Host "   - Import Script -> ZhipuAI API" -ForegroundColor White
Write-Host "   - Asset Library -> CLIP Service (localhost:8000)" -ForegroundColor White
Write-Host "   - Video Description -> VLM Service (localhost:8001)" -ForegroundColor White