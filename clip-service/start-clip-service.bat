@echo off
chcp 65001 >nul
echo ============================================
echo CLIP视频打标服务 - 启动脚本
echo ============================================
echo.

REM 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.9+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

cd /d "%~dp0"

REM 检查虚拟环境
if not exist "venv" (
    echo [1/3] 创建虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
)

REM 激活虚拟环境
echo [2/3] 激活虚拟环境...
call venv\Scripts\activate.bat

REM 安装依赖
if not exist "venv\.installed" (
    echo [3/3] 安装依赖（首次启动需要较长时间）...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 安装依赖失败
        pause
        exit /b 1
    )
    echo. > venv\.installed
)

echo.
echo ============================================
echo 启动CLIP服务 (端口: 8000)
echo API文档: http://localhost:8000/docs
echo ============================================
echo.

python clip_server.py

pause
