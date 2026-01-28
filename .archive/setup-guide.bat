@echo off
chcp 65001 >nul
echo ============================================
echo cgcut Project Setup Guide
echo ============================================
echo.

echo This script will guide you through the complete setup
echo Including: Environment check, Dependency installation, Configuration verification
echo.

:menu
echo.
echo Please select an option:
echo 1. Run environment check
echo 2. Run automated installation  
echo 3. Verify installation results
echo 4. Start all services
echo 5. Run complete setup process
echo 6. Exit
echo.

set /p choice="Enter your selection (1-6): "

if "%choice%"=="1" goto check
if "%choice%"=="2" goto install
if "%choice%"=="3" goto verify
if "%choice%"=="4" goto start
if "%choice%"=="5" goto fullsetup
if "%choice%"=="6" goto exit

echo Invalid selection, please retry
goto menu

:check
echo.
echo Running environment check...
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"
goto menu

:install
echo.
echo Running automated installation...
powershell -ExecutionPolicy Bypass -File "auto-setup.ps1"
goto menu

:verify
echo.
echo Verifying installation results...
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"
goto menu

:start
echo.
echo Starting all services...
call "start-all-services.bat"
goto menu

:fullsetup
echo.
echo ============================================
echo Running Complete Setup Process
echo ============================================
echo.

echo Step 1: Check current environment
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"

echo.
echo Step 2: Install dependencies
powershell -ExecutionPolicy Bypass -File "auto-setup.ps1"

echo.
echo Step 3: Verify installation results
powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"

echo.
echo ============================================
echo Complete Setup Process Finished!
echo ============================================
echo.
echo Now you can:
echo 1. Check API key configuration in .env file
echo 2. Run start-all-services.bat to start services
echo 3. Visit http://localhost:5173 to use the app
echo.
pause
goto menu

:exit
echo.
echo Thank you for using cgcut Project Setup Wizard!
pause