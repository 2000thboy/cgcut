@echo off
chcp 65001 >nul
echo ============================================
echo cgcut 项目自动化安装
echo ============================================
echo.

echo 正在启动自动化安装脚本...
echo 请注意：脚本可能需要管理员权限来安装软件
echo.

REM 运行PowerShell脚本
powershell -ExecutionPolicy Bypass -File "auto-setup.ps1"

echo.
echo ============================================
echo 自动化安装脚本执行完成
echo ============================================
echo.
echo 请检查上面的输出以了解安装状态
echo.
pause