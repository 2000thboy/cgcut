@echo off
chcp 65001 >nul
echo.
echo ================================
echo    CGCUT 项目 GitHub 上传助手
echo ================================
echo.
echo 正在检查本地仓库状态...
git status
echo.
echo 正在尝试推送代码到 GitHub...
echo 如果弹出登录窗口，请完成登录。
echo 如果命令行提示输入密码，推荐使用 GitHub Personal Access Token。
echo.
git push -u origin main
echo.
echo 检查推送结果...
if %errorlevel% == 0 (
  echo.
  echo **************************************
  echo   项目已成功上传到 GitHub！
  echo **************************************
  echo.
) else (
  echo.
  echo 错误：推送失败 (Error Level: %errorlevel%)
  echo 请确认：
  echo 1. 您已在 GitHub 上创建了名为 "cgcut" 的仓库
  echo 2. 您的网络可以正常访问 github.com (可能需要科学上网)
  echo 3. 如果您在终端中手动执行 "git push -u origin main" 成功，则忽略此错误
  echo.
)
pause