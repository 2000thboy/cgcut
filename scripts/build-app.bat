@echo off
echo 构建 CGCUT 项目...
echo.

REM 检查是否已安装Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查是否已安装npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到npm，请先安装Node.js
    pause
    exit /b 1
)

REM 切换到项目目录
cd /d "%~dp0"

REM 检查node_modules是否存在，如果不存在则安装依赖
if not exist "node_modules" (
    echo 正在安装项目依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 错误: 安装依赖失败
        pause
        exit /b 1
    )
)

echo 正在构建项目...
npm run build

if %errorlevel% eq 0 (
    echo 构建成功完成！
) else (
    echo 构建失败。
)

pause