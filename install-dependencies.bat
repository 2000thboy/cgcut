@echo off
chcp 65001 >nul
echo ============================================
echo cgcut 项目依赖安装脚本
echo ============================================
echo.

REM 检查Node.js
echo [1/4] 检查Node.js和npm...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo [✓] Node.js已安装
    npm --version >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未找到npm
        pause
        exit /b 1
    ) else (
        echo [✓] npm已安装
    )
)

REM 检查Python
echo.
echo [2/4] 检查Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.9+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
) else (
    echo [✓] Python已安装
)

REM 安装前端依赖
echo.
echo [3/4] 安装前端依赖...
cd /d "%~dp0"
if exist "package-lock.json" (
    echo 删除旧的依赖锁文件...
    del package-lock.json
)
if exist "node_modules" (
    echo 删除旧的依赖目录...
    rmdir /s /q node_modules
)

echo 运行 npm install...
npm install
if errorlevel 1 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
) else (
    echo [✓] 前端依赖安装完成
)

REM 安装后端依赖
echo.
echo [4/4] 安装后端依赖...

REM 安装CLIP服务依赖
echo 安装CLIP服务依赖...
cd clip-service
if not exist "venv" (
    echo 创建Python虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
)

echo 激活虚拟环境并安装依赖...
call venv\Scripts\activate.bat
pip install --upgrade pip
if errorlevel 1 (
    echo [错误] 更新pip失败
    pause
    exit /b 1
)

pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] CLIP服务依赖安装失败
    pause
    exit /b 1
) else (
    echo [✓] CLIP服务依赖安装完成
)

REM 安装VLM服务依赖
echo.
echo 安装VLM服务依赖...
cd ../vlm-service
call ../clip-service/venv/Scripts/activate.bat
pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] VLM服务依赖安装失败
    pause
    exit /b 1
) else (
    echo [✓] VLM服务依赖安装完成
)

REM 检查环境配置文件
echo.
echo 检查环境配置文件...
cd ..
if not exist ".env" (
    echo 复制环境配置文件示例...
    copy .env.example .env
    echo.
    echo 注意: 请编辑 .env 文件并填入您的API密钥
    echo 访问 https://open.bigmodel.cn/ 获取智谱AI API密钥
)

echo.
echo ============================================
echo 所有依赖安装完成！
echo ============================================
echo.
echo 接下来您可以：
echo 1. 编辑 .env 文件填入API密钥
echo 2. 启动CLIP服务: cd clip-service && python clip_server.py
echo 3. 启动VLM服务: cd vlm-service && python vlm_server.py  
echo 4. 启动前端: npm run dev
echo.
echo 访问 http://localhost:5173 使用应用
echo.
pause