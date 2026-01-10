# CGCUT 项目启动脚本

Write-Host "启动 CGCUT 项目开发环境..." -ForegroundColor Green
Write-Host ""

# 检查是否已安装Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到Node.js，请先安装Node.js" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查是否已安装npm
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到npm，请先安装Node.js" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 切换到当前脚本所在目录
Set-Location -Path $PSScriptRoot

# 检查node_modules是否存在，如果不存在则安装依赖
if (!(Test-Path "node_modules")) {
    Write-Host "正在安装项目依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 安装依赖失败" -ForegroundColor Red
        Read-Host "按任意键退出"
        exit 1
    }
}

# 启动开发服务器
Write-Host "启动开发服务器..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-Command", "Set-Location -Path '$PSScriptRoot'; npm run dev"

Write-Host "等待开发服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "注意：如果端口5173被占用，Vite会自动选择其他端口" -ForegroundColor Yellow

Write-Host "尝试打开浏览器..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "开发服务器已启动！请检查浏览器窗口" -ForegroundColor Green
Write-Host "如果无法访问5173端口，请查看命令行窗口以获取实际端口" -ForegroundColor Yellow
Write-Host "按任意键关闭服务器并退出..." -ForegroundColor Red
Read-Host "按任意键退出"

# 尝试停止可能仍在运行的进程
Stop-Process -Name "node" -ErrorAction SilentlyContinue
Stop-Process -Name "npm" -ErrorAction SilentlyContinue