# cgcut 项目自动化安装脚本
Write-Host "🚀 cgcut 项目自动化安装脚本" -ForegroundColor Green
Write-Host "=" * 50

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  警告: 建议以管理员身份运行此脚本以避免权限问题" -ForegroundColor Yellow
    $continue = Read-Host "是否继续? (y/N)"
    if ($continue -ne 'y') {
        exit
    }
}

# 检查并安装 Node.js
Write-Host "`n🔍 检查 Node.js..." -ForegroundColor Cyan
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if ($nodeInstalled) {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion 已安装" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js 未安装，开始安装..." -ForegroundColor Red
    Write-Host "⬇️  正在下载 Node.js LTS..." -ForegroundColor Yellow
    
    # 下载 Node.js LTS 安装包
    $nodeUrl = "https://nodejs.org/dist/latest-v18.x/node-v18.18.2-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
        Write-Host "✅ Node.js 下载完成" -ForegroundColor Green
        
        Write-Host "🔧 正在安装 Node.js，请按提示完成安装..." -ForegroundColor Yellow
        Write-Host "📝 注意: 安装过程中请确保勾选 'Add to PATH' 选项" -ForegroundColor Magenta
        Start-Process -FilePath "msiexec" -ArgumentList "/i `"$nodeInstaller`" /quiet" -Wait
        
        # 验证安装
        $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeInstalled) {
            $nodeVersion = node --version
            Write-Host "✅ Node.js $nodeVersion 安装成功" -ForegroundColor Green
        } else {
            Write-Host "❌ Node.js 安装失败，请手动安装" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Node.js 下载失败: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 请手动访问 https://nodejs.org/ 下载并安装 Node.js LTS 版本" -ForegroundColor Yellow
    }
}

# 检查并安装 Python
Write-Host "`n🔍 检查 Python..." -ForegroundColor Cyan
$pythonInstalled = Get-Command python -ErrorAction SilentlyContinue
if ($pythonInstalled) {
    $pythonVersion = python --version
    Write-Host "✅ Python $pythonVersion 已安装" -ForegroundColor Green
} else {
    Write-Host "❌ Python 未安装，开始安装..." -ForegroundColor Red
    Write-Host "⬇️  正在下载 Python 3.11..." -ForegroundColor Yellow
    
    # 下载 Python 3.11 安装包
    $pythonUrl = "https://www.python.org/ftp/python/3.11.6/python-3.11.6-amd64.exe"
    $pythonInstaller = "$env:TEMP\python-installer.exe"
    
    try {
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing
        Write-Host "✅ Python 下载完成" -ForegroundColor Green
        
        Write-Host "🔧 正在安装 Python，请按提示完成安装..." -ForegroundColor Yellow
        Write-Host "📝 注意: 安装过程中请务必勾选 'Add Python to PATH' 选项" -ForegroundColor Magenta
        Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
        
        # 验证安装
        $pythonInstalled = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonInstalled) {
            $pythonVersion = python --version
            Write-Host "✅ Python $pythonVersion 安装成功" -ForegroundColor Green
        } else {
            Write-Host "❌ Python 安装失败，请手动安装" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Python 下载失败: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 请手动访问 https://www.python.org/downloads/ 下载并安装 Python 3.9+ 版本" -ForegroundColor Yellow
    }
}

# 验证安装
Write-Host "`n🔍 验证安装结果..." -ForegroundColor Cyan
$nodeOk = Get-Command node -ErrorAction SilentlyContinue
$npmOk = Get-Command npm -ErrorAction SilentlyContinue
$pythonOk = Get-Command python -ErrorAction SilentlyContinue
$pipOk = Get-Command pip -ErrorAction SilentlyContinue

$allOk = $true
if (-not $nodeOk) {
    Write-Host "❌ Node.js 未正确安装" -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "✅ Node.js 已安装" -ForegroundColor Green
}

if (-not $npmOk) {
    Write-Host "❌ NPM 未正确安装" -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "✅ NPM 已安装" -ForegroundColor Green
}

if (-not $pythonOk) {
    Write-Host "❌ Python 未正确安装" -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "✅ Python 已安装" -ForegroundColor Green
}

if (-not $pipOk) {
    Write-Host "❌ Pip 未正确安装" -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "✅ Pip 已安装" -ForegroundColor Green
}

if ($allOk) {
    Write-Host "`n🎉 所有基础环境已安装成功!" -ForegroundColor Green
    Write-Host "🔄 现在开始安装项目依赖..." -ForegroundColor Cyan
    
    # 安装前端依赖
    Write-Host "`n📦 安装前端依赖..." -ForegroundColor Yellow
    try {
        Set-Location $PSScriptRoot
        npm install
        Write-Host "✅ 前端依赖安装完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 前端依赖安装失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 安装后端依赖
    Write-Host "`n🐍 安装后端依赖..." -ForegroundColor Yellow
    try {
        Set-Location "$PSScriptRoot\clip-service"
        if (-not (Test-Path "venv")) {
            python -m venv venv
            Write-Host "✅ Python 虚拟环境创建完成" -ForegroundColor Green
        }
        
        # 激活虚拟环境并安装依赖
        & "$PSScriptRoot\clip-service\venv\Scripts\Activate.ps1"
        pip install --upgrade pip
        pip install -r requirements.txt
        Write-Host "✅ CLIP服务依赖安装完成" -ForegroundColor Green
        
        Set-Location "$PSScriptRoot\vlm-service"
        & "$PSScriptRoot\clip-service\venv\Scripts\Activate.ps1"
        pip install -r requirements.txt
        Write-Host "✅ VLM服务依赖安装完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 后端依赖安装失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 检查环境配置文件
    Set-Location $PSScriptRoot
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 环境配置文件已创建，请记得填入您的API密钥" -ForegroundColor Yellow
    }
    
    Write-Host "`n🎊 项目安装完成!" -ForegroundColor Green
    Write-Host "💡 接下来您可以：" -ForegroundColor Cyan
    Write-Host "   1. 编辑 .env 文件填入API密钥" -ForegroundColor White
    Write-Host "   2. 运行 start-all-services.bat 启动所有服务" -ForegroundColor White
    Write-Host "   3. 访问 http://localhost:5173 使用应用" -ForegroundColor White
} else {
    Write-Host "`n❌ 环境检查未通过，请按照提示手动安装缺失的组件" -ForegroundColor Red
    Write-Host "💡 请确保安装了 Node.js 和 Python，并正确添加到 PATH" -ForegroundColor Yellow
}

Write-Host "`n按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")