@echo off
chcp 65001 >nul
echo ============================================
echo cgcut 项目完整设置向导
echo ============================================
echo.

echo 此脚本将引导您完成 cgcut 项目的完整设置
echo 包括：环境检查、依赖安装、配置验证
echo.

:menu
echo.
echo 请选择操作：
echo 1. 运行环境检查
echo 2. 运行自动化安装
echo 3. 验证安装结果
echo 4. 启动所有服务
echo 5. 运行完整设置流程
echo 6. 退出
echo.

set /p choice="请输入选择 (1-6): "

if "%choice%"=="1" goto check
if "%choice%"=="2" goto install
if "%choice%"=="3" goto verify
if "%choice%"=="4" goto start
if "%choice%"=="5" goto fullsetup
if "%choice%"=="6" goto exit

echo 无效选择，请重试
goto menu

:check
echo.
echo 运行环境检查...
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"
goto menu

:install
echo.
echo 运行自动化安装...
powershell -ExecutionPolicy Bypass -File "auto-setup.ps1"
goto menu

:verify
echo.
echo 验证安装结果...
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"
goto menu

:start
echo.
echo 启动所有服务...
call "start-all-services.bat"
goto menu

:fullsetup
echo.
echo ============================================
echo 运行完整设置流程
echo ============================================
echo.

echo 步骤 1: 检查当前环境
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"

echo.
echo 步骤 2: 安装依赖
powershell -ExecutionPolicy Bypass -File "auto-setup.ps1"

echo.
echo 步骤 3: 验证安装结果
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"

echo.
echo ============================================
echo 完整设置流程完成！
echo ============================================
echo.
echo 现在您可以：
echo 1. 检查 .env 文件中的 API 密钥配置
echo 2. 运行 start-all-services.bat 启动服务
echo 3. 访问 http://localhost:5173 使用应用
echo.
pause
goto menu

:exit
echo.
echo 感谢使用 cgcut 项目设置向导！
pause