@echo off
setlocal enabledelayedexpansion

echo ====================================
echo    CGCUT 服务启动脚本 (改进版)
echo ====================================
echo.

:: 检查Docker是否可用
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker 已安装，支持一键启动
    set DOCKER_AVAILABLE=1
) else (
    echo ❌ Docker 未安装，使用本地启动
    set DOCKER_AVAILABLE=0
)

:: 检查端口占用情况
echo.
echo 📡 检查服务端口占用情况...

:: 检查前端端口 (5173)
netstat -an | findstr ":5173" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  端口 5173 已被占用
    set FRONTEND_PORT=5174
) else (
    echo ✅ 端口 5173 可用
    set FRONTEND_PORT=5173
)

:: 检查CLIP服务端口 (8000)
netstat -an | findstr ":8000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  端口 8000 已被占用
    set CLIP_PORT=8000
    echo ℹ️  CLIP服务已在运行，跳过启动
) else (
    echo ✅ 端口 8000 可用
    set CLIP_PORT=8000
)

:: 检查VLM服务端口 (8001)
netstat -an | findstr ":8001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  端口 8001 已被占用
    set VLM_PORT=8001
    echo ℹ️  VLM服务已在运行，跳过启动
) else (
    echo ✅ 端口 8001 可用
    set VLM_PORT=8001
)

:: 检查前端实际运行端口 (8003-8005)
for /l %%i in (8003,8004,8005,8006,8007,8008) do (
    netstat -an | findstr ":%%i" >nul 2>&1
    if !errorlevel! equ 0 (
        echo ℹ️  发现前端服务运行在端口 %%i
        set FRONTEND_RUNNING=%%i
        goto :frontend_found
    )
)
:frontend_found

echo.
echo 🚀 启动服务...

:: 启动CLIP服务 (如果未运行)
if not defined CLIP_PORT (
    echo 📹 启动 CLIP 服务...
    cd clip-service && python clip_server.py
    start /b cmd /k "cd clip-service && python clip_server.py"
) else (
    echo ℹ️  CLIP 服务已运行，跳过
)

:: 等待CLIP服务启动
timeout /t 3 >nul

:: 启动VLM服务 (如果未运行)
if not defined VLM_PORT (
    echo 🎬 启动 VLM 服务...
    cd vlm-service && python vlm_server.py
    start /b cmd /k "cd vlm-service && python vlm_server.py"
) else (
    echo ℹ️  VLM 服务已运行，跳过
)

:: 等待VLM服务启动
timeout /t 3 >nul

:: 启动前端服务
if %DOCKER_AVAILABLE% equ 1 (
    echo 🐳 使用 Docker 启动前端...
    docker-compose up --build frontend
) else (
    echo 🌐 启动前端开发服务器...
    if defined FRONTEND_RUNNING (
        echo ℹ️  前端服务已在端口 %FRONTEND_RUNNING% 运行
        echo 🌐 前端地址: http://localhost:%FRONTEND_RUNNING%
    ) else (
        echo 🌐 启动前端服务器在端口 %FRONTEND_PORT%...
        start /b cmd /k "npm run dev"
        echo 🌐 前端地址: http://localhost:%FRONTEND_PORT%
    )
)

echo.
echo ====================================
echo    服务启动完成！
echo ====================================
echo.
echo 📍 服务地址:
if defined CLIP_PORT (
    echo    📹 CLIP服务: http://localhost:%CLIP_PORT%
)
if defined VLM_PORT (
    echo    🎬 VLM服务: http://localhost:%VLM_PORT%
)
if defined FRONTEND_PORT (
    echo    🌐 前端服务: http://localhost:%FRONTEND_PORT%
)
if defined FRONTEND_RUNNING (
    echo    🌐 前端服务: http://localhost:%FRONTEND_RUNNING% (已运行)
)
echo.
echo 💡 使用 Ctrl+C 停止所有服务
echo.
echo 🐳 如需使用Docker，运行: docker-compose up
echo.

pause