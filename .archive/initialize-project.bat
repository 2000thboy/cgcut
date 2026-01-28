@echo off
chcp 65001 >nul
echo ============================================
echo cgcut 项目初始化向导
echo ============================================
echo.

echo 欢迎使用 cgcut 项目初始化向导
echo 我们将引导您完成必要的环境设置
echo.

:prerequisites
echo.
echo 步骤 1: 检查系统必备组件
echo ----------------------------
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装
    echo    请访问 https://nodejs.org/ 下载并安装 Node.js LTS 版本
    set NODE_MISSING=true
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js %NODE_VERSION% 已安装
    set NODE_MISSING=false
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    if "%NODE_MISSING%"=="false" (
        echo ⚠️  NPM 未安装，但 Node.js 已安装
        echo    重新安装 Node.js 并确保包含 NPM
    ) else (
        echo ❌ NPM 未安装
    )
    set NPM_MISSING=true
) else (
    if "%NODE_MISSING%"=="false" (
        for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
        echo ✅ NPM %NPM_VERSION% 已安装
    )
    set NPM_MISSING=false
)

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python 未安装
    echo    请访问 https://www.python.org/downloads/ 下载并安装 Python 3.9+
    set PYTHON_MISSING=true
) else (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo ✅ Python %PYTHON_VERSION% 已安装
    set PYTHON_MISSING=false
)

pip --version >nul 2>&1
if %errorlevel% neq 0 (
    if "%PYTHON_MISSING%"=="false" (
        echo ⚠️  Pip 未安装，但 Python 已安装
        echo    重新安装 Python 并确保勾选 "Add Python to PATH"
    ) else (
        echo ❌ Pip 未安装
    )
    set PIP_MISSING=true
) else (
    if "%PYTHON_MISSING%"=="false" (
        for /f "tokens=*" %%i in ('pip --version') do set PIP_VERSION=%%i
        echo ✅ Pip %PIP_VERSION% 已安装
    )
    set PIP_MISSING=false
)

echo.
if "%NODE_MISSING%"=="true" goto installinstructions
if "%NPM_MISSING%"=="true" goto installinstructions
if "%PYTHON_MISSING%"=="true" goto installinstructions
if "%PIP_MISSING%"=="true" goto installinstructions

echo 🎉 所有必备组件均已安装！
echo.
goto dependencyinstall

:installinstructions
echo 以下是安装说明：
echo.
if "%NODE_MISSING%"=="true" (
    echo 1. 安装 Node.js:
    echo    - 访问 https://nodejs.org/
    echo    - 下载 LTS 版本
    echo    - 安装时确保勾选 "Add to PATH"
)
if "%PYTHON_MISSING%"=="true" (
    echo 2. 安装 Python:
    echo    - 访问 https://www.python.org/downloads/
    echo    - 下载 Python 3.9 或更高版本
    echo    - 安装时确保勾选 "Add Python to PATH"
)
echo.
echo 安装完成后，请重新运行此脚本。
pause
exit /b

:dependencyinstall
echo 步骤 2: 安装项目依赖
echo ----------------------------

echo.
set /p install_deps="是否现在安装项目依赖? (Y/N): "
if /i not "%install_deps%"=="y" goto finish

echo.
echo 正在安装前端依赖...
if exist "node_modules" (
    echo 删除旧的 node_modules...
    rmdir /s /q node_modules >nul 2>&1
)
echo 运行 npm install...
npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    echo    请检查网络连接并重试
    pause
    exit /b 1
) else (
    echo ✅ 前端依赖安装完成
)

echo.
echo 正在安装后端依赖...

REM 安装 CLIP 服务依赖
echo 安装 CLIP 服务依赖...
cd clip-service
if not exist "venv" (
    echo 创建 Python 虚拟环境...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ Python 虚拟环境创建失败
        cd ..
        pause
        exit /b 1
    )
)

echo 激活虚拟环境并安装依赖...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ CLIP 服务依赖安装失败
    cd ..
    pause
    exit /b 1
) else (
    echo ✅ CLIP 服务依赖安装完成
)

REM 安装 VLM 服务依赖
cd ..
cd vlm-service
call ..\clip-service\venv\Scripts\activate.bat
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ VLM 服务依赖安装失败
    cd ..
    pause
    exit /b 1
) else (
    echo ✅ VLM 服务依赖安装完成
)

cd ..

REM 检查环境配置文件
if not exist ".env" (
    echo 创建环境配置文件...
    copy .env.example .env
    echo ✅ 环境配置文件已创建
    echo    请编辑 .env 文件并填入您的 API 密钥
)

echo.
echo 🎉 项目依赖安装完成！
echo.

:finish
echo.
echo ============================================
echo 初始化完成！
echo ============================================
echo.
echo 接下来您可以：
echo 1. 编辑 .env 文件填入 API 密钥
echo 2. 运行 start-all-services.bat 启动所有服务
echo 3. 访问 http://localhost:5173 使用应用
echo.
echo 所有按钮都已连接到真实的 API 端点：
echo - 剧本导入 → 智谱AI API
echo - 素材库功能 → CLIP 服务 (localhost:8000)
echo - 视频描述 → VLM 服务 (localhost:8001)
echo ============================================
echo.

pause