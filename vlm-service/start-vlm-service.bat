@echo off
chcp 65001 >nul
echo ============================================
echo MiniMind-V 视频描述服务 - 启动脚本
echo ============================================
echo.

cd /d "%~dp0"

REM 检查是否使用clip-service的虚拟环境
if exist "..\clip-service\venv\Scripts\activate.bat" (
    echo [使用共享虚拟环境]
    call ..\clip-service\venv\Scripts\activate.bat
    goto :start
)

REM 创建独立虚拟环境
if not exist "venv" (
    echo [1/3] 创建虚拟环境...
    python -m venv venv
)

echo [2/3] 激活虚拟环境...
call venv\Scripts\activate.bat

if not exist "venv\.installed" (
    echo [3/3] 安装依赖...
    pip install -r requirements.txt
    echo. > venv\.installed
)

:start
echo.
echo ============================================
echo 启动VLM服务 (端口: 8001)
echo API文档: http://localhost:8001/docs
echo ============================================
echo.

python vlm_server.py

pause
