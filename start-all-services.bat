@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ============================================
echo cgcut 项目一键启动脚本
echo ============================================
echo.

REM 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Node.js
    echo 请先安装Node.js并重新运行此脚本
    pause
    exit /b 1
)

REM 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python
    echo 请先安装Python 3.9+并重新运行此脚本
    pause
    exit /b 1
)

echo 启动服务顺序：
echo 1. CLIP服务 (端口 8000)
echo 2. VLM服务 (端口 8001) 
echo 3. 视频导出服务 (端口 8002)
echo 4. 健康检查服务 (端口 8003)
echo 5. 前端服务 (端口 5173)
echo.

REM 检查服务是否已在运行
echo 检查端口占用情况...
netstat -an | findstr :8000 >nul
if not errorlevel 1 (
    echo [警告] 端口8000已被占用
)
netstat -an | findstr :8001 >nul
if not errorlevel 1 (
    echo [警告] 端口8001已被占用
)
netstat -an | findstr :8002 >nul
if not errorlevel 1 (
    echo [警告] 端口8002已被占用
)
netstat -an | findstr :8003 >nul
if not errorlevel 1 (
    echo [警告] 端口8003已被占用
)
netstat -an | findstr :5173 >nul
if not errorlevel 1 (
    echo [警告] 端口5173已被占用
)

echo.
set /p confirm="确定要启动所有服务吗? (y/N): "
if /i not "%confirm%"=="y" (
    echo 操作已取消
    pause
    exit /b 0
)

REM 启动CLIP服务
echo.
echo ============================================
echo 启动 CLIP 服务 (端口 8000)
echo ============================================
start "CLIP-Service" cmd /k "cd /d %~dp0clip-service && python start_offline.py"
timeout /t 3 /nobreak >nul

REM 启动VLM服务
echo.
echo ============================================
echo 启动 VLM 服务 (端口 8001)
echo ============================================
start "VLM-Service" cmd /k "cd /d %~dp0vlm-service && venv\Scripts\python.exe vlm_server.py"
timeout /t 3 /nobreak >nul

REM 启动视频导出服务
echo.
echo ============================================
echo 启动 视频导出服务 (端口 8002)
echo ============================================
start "Export-Service" cmd /k "cd /d %~dp0video-export-service && venv\Scripts\python.exe export_server.py"
timeout /t 3 /nobreak >nul

REM 启动健康检查服务
echo.
echo ============================================
echo 启动 健康检查服务 (端口 8003)
echo ============================================
start "Health-Service" cmd /k "cd /d %~dp0 && python health_server.py"
timeout /t 3 /nobreak >nul

REM 启动前端服务
echo.
echo ============================================
echo 启动 前端服务 (端口 5173)
echo ============================================
start "Frontend-Service" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ============================================
echo 服务启动完成！
echo ============================================
echo.
echo CLIP服务: http://localhost:8000
echo VLM服务: http://localhost:8001
echo 视频导出服务: http://localhost:8002
echo 健康检查服务: http://localhost:8003
echo 前端服务: http://localhost:5173
echo.
echo 所有服务已在新窗口中启动
echo 请在各个窗口中查看服务状态
echo.
pause