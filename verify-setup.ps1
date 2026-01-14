# cgcut 项目配置验证脚本
Write-Host "🔍 cgcut 项目配置验证" -ForegroundColor Green
Write-Host "=" * 40

# 检查 Node.js 和 npm
Write-Host "`n检查 Node.js 和 npm..." -ForegroundColor Cyan
try {
    $nodeVersion = $(node --version) 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js 未安装或不在PATH中" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Node.js 未安装或不在PATH中" -ForegroundColor Red
}

try {
    $npmVersion = $(npm --version) 2>$null
    if ($npmVersion) {
        Write-Host "✅ NPM $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ NPM 未安装或不在PATH中" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ NPM 未安装或不在PATH中" -ForegroundColor Red
}

# 检查 Python 和 pip
Write-Host "`n检查 Python 和 pip..." -ForegroundColor Cyan
try {
    $pythonVersion = $(python --version) 2>$null
    if ($pythonVersion) {
        Write-Host "✅ Python $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Python 未安装或不在PATH中" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Python 未安装或不在PATH中" -ForegroundColor Red
}

try {
    $pipVersion = $(pip --version) 2>$null
    if ($pipVersion) {
        Write-Host "✅ Pip $pipVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Pip 未安装或不在PATH中" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Pip 未安装或不在PATH中" -ForegroundColor Red
}

# 检查项目依赖
Write-Host "`n检查项目依赖..." -ForegroundColor Cyan

# 检查前端依赖
$packageJsonExists = Test-Path "package.json"
$nodeModulesExists = Test-Path "node_modules"

if ($packageJsonExists) {
    Write-Host "✅ package.json 存在" -ForegroundColor Green
} else {
    Write-Host "❌ package.json 不存在" -ForegroundColor Red
}

if ($nodeModulesExists) {
    Write-Host "✅ node_modules 存在 (前端依赖已安装)" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules 不存在 (需要运行 npm install)" -ForegroundColor Yellow
}

# 检查后端服务
$clipServiceExists = Test-Path "clip-service"
$vlmServiceExists = Test-Path "vlm-service"

if ($clipServiceExists) {
    Write-Host "✅ CLIP服务目录存在" -ForegroundColor Green
    $clipVenvExists = Test-Path "clip-service\venv"
    if ($clipVenvExists) {
        Write-Host "✅ CLIP服务虚拟环境存在" -ForegroundColor Green
    } else {
        Write-Host "⚠️  CLIP服务虚拟环境不存在 (需要设置Python虚拟环境)" -ForegroundColor Yellow
    }
    
    $clipReqsExists = Test-Path "clip-service\requirements.txt"
    if ($clipReqsExists) {
        Write-Host "✅ CLIP服务依赖文件存在" -ForegroundColor Green
    }
} else {
    Write-Host "❌ CLIP服务目录不存在" -ForegroundColor Red
}

if ($vlmServiceExists) {
    Write-Host "✅ VLM服务目录存在" -ForegroundColor Green
    $vlmReqsExists = Test-Path "vlm-service\requirements.txt"
    if ($vlmReqsExists) {
        Write-Host "✅ VLM服务依赖文件存在" -ForegroundColor Green
    }
} else {
    Write-Host "❌ VLM服务目录不存在" -ForegroundColor Red
}

# 检查环境配置
Write-Host "`n检查环境配置..." -ForegroundColor Cyan
$envExists = Test-Path ".env"
$envExampleExists = Test-Path ".env.example"

if ($envExists) {
    Write-Host "✅ .env 配置文件存在" -ForegroundColor Green
    # 检查API密钥是否已配置
    $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
    if ($envContent -and $envContent | Select-String "your_zhipu_api_key_here") {
        Write-Host "⚠️  API密钥尚未配置 (请编辑 .env 文件填入您的API密钥)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ API密钥已配置" -ForegroundColor Green
    }
} else {
    if ($envExampleExists) {
        Write-Host "⚠️  .env 文件不存在，但 .env.example 存在 (需要复制并配置API密钥)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ .env 和 .env.example 都不存在" -ForegroundColor Red
    }
}

# 检查IDE配置
Write-Host "`n检查IDE配置..." -ForegroundColor Cyan
$vscodeDirExists = Test-Path ".vscode"
if ($vscodeDirExists) {
    Write-Host "✅ VS Code 配置目录存在" -ForegroundColor Green
    if (Test-Path ".vscode\settings.json") {
        Write-Host "✅ VS Code 设置文件存在" -ForegroundColor Green
    }
    if (Test-Path ".vscode\extensions.json") {
        Write-Host "✅ VS Code 推荐扩展文件存在" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  VS Code 配置目录不存在" -ForegroundColor Yellow
}

# 总结
Write-Host "`n" + "=" * 40 -ForegroundColor Green
Write-Host "验证完成!" -ForegroundColor Green

$checks = @()
$checks += [bool]$(node --version 2>$null)
$checks += [bool]$(npm --version 2>$null)
$checks += [bool]$(python --version 2>$null)
$checks += [bool]$(pip --version 2>$null)
$checks += $packageJsonExists
$checks += $nodeModulesExists
$checks += $clipServiceExists
$checks += $vlmServiceExists
$checks += $envExists

$passed = ($checks | Where-Object {$_}).Count
$total = $checks.Count

Write-Host "检查结果: $passed/$total 项通过" -ForegroundColor $(if($passed -eq $total) {"Green"} else {"Yellow"})

if ($passed -eq $total) {
    Write-Host "`n🎉 所有配置检查通过! 您可以开始使用 cgcut 项目。" -ForegroundColor Green
    Write-Host "💡 运行 start-all-services.bat 来启动所有服务。" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  部分检查未通过，请参考上面的输出解决问题。" -ForegroundColor Yellow
    Write-Host "💡 运行 auto-setup.ps1 或 install-dependencies.bat 来安装缺失的依赖。" -ForegroundColor Cyan
}

Write-Host "`n按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")