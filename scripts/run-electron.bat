@echo off
echo 启动 CGCUT 项目 Electron 桌面应用...
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

echo 启动 Electron 桌面应用...
echo 如果端口5173被占用，Vite会自动选择其他端口
echo 请查看命令行输出以获取正确的访问地址
echo 按 Ctrl+C 可以停止应用
echo =========================================
npm run electron:dev