@echo off
echo 启动 CGCUT 项目开发环境...
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

echo 启动开发服务器...
start "Vite Dev Server" cmd /c "npm run dev"

echo 等待开发服务器启动...
timeout /t 5 /nobreak >nul

echo 注意：如果端口5173被占用，Vite会自动选择其他端口

echo 尝试打开浏览器...
start http://localhost:5173

echo 开发服务器已启动！请检查浏览器窗口
echo 如果无法访问5173端口，请查看命令行窗口以获取实际端口
echo 按任意键关闭服务器并退出...
pause

REM 关闭可能仍在运行的进程
taskkill /f /im node.exe 2>nul
taskkill /f /im npm.exe 2>nul