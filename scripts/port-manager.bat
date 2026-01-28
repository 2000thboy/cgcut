@echo off
setlocal enabledelayedexpansion

echo ====================================
echo    CGCUT 端口管理工具
echo ====================================
echo.

:: 显示当前端口占用情况
echo 📊 当前端口占用情况:
echo ----------------------------------------
echo 检查端口 8000-8010:
echo.

for /l %%i in (8000,8001,8002,8003,8004,8005,8006,8007,8008,8009,8010) do (
    netstat -an | findstr ":%%i " >nul 2>&1
    if !errorlevel! equ 0 (
        echo    端口 %%i: [占用]
    ) else (
        echo    端口 %%i: [空闲]
    )
)

echo ----------------------------------------
echo.

:: 检查Vite前端端口
echo 🌐 前端服务端口检查:
netstat -an | findstr ":517" >nul 2>&1
if %errorlevel% equ 0 (
    echo    端口 5173: [可能占用]
) else (
    echo    端口 5173: [空闲]
)
echo.

:: 提供选项
echo.
echo 🛠️  可用操作:
echo    1. 杀死所有8000-8010端口进程
echo    2. 杀死Node.js进程  
echo    3. 快速重启所有CGCUT服务
echo    4. 检查Docker服务状态
echo    5. 退出
echo.

set /p choice="请选择操作 (1-5): "

if "%choice%"=="1" (
    echo 🧹 正在终止端口8000-8010的所有进程...
    for /l %%i in (8000,8001,8002,8003,8004,8005,8006,8007,8008,8009,8010) do (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%i"') do (
            taskkill /f /pid %%a >nul 2>&1
        )
    )
    echo ✅ 已清理所有相关端口进程
)

if "%choice%"=="2" (
    echo 🌐 正在终止Node.js进程...
    taskkill /f /im node.exe >nul 2>&1
    echo ✅ 已终止所有Node.js进程
)

if "%choice%"=="3" (
    echo 🔄 重启CGCUT服务...
    call "%~dp0\scripts\start-all-services-improved.bat"
)

if "%choice%"=="4" (
    echo 🐳 检查Docker服务状态...
    docker ps
    docker-compose ps
)

if "%choice%"=="5" (
    echo 👋 退出
    exit /b 0
)

echo.
pause