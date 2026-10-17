@echo off
setlocal
echo Starting Baozhi... Please keep this window open until the address appears.
chcp 65001 >nul
cd /d "%~dp0"
set "BAOZHI_LAUNCH_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%BAOZHI_LAUNCH_PYTHON%" goto bundled
where py.exe >nul 2>nul
if not errorlevel 1 goto pylauncher
where python.exe >nul 2>nul
if not errorlevel 1 goto systempython
echo Python 3.11 or newer is required. Please install Python and retry.
set "BAOZHI_LAUNCH_EXIT=1"
goto finish
:bundled
"%BAOZHI_LAUNCH_PYTHON%" -X utf8 "%~dp0launch.py" %*
goto result
:pylauncher
py -3 -X utf8 "%~dp0launch.py" %*
goto result
:systempython
python -X utf8 "%~dp0launch.py" %*
:result
set "BAOZHI_LAUNCH_EXIT=%errorlevel%"
:finish
if "%~1"=="" goto interactive
if not "%BAOZHI_LAUNCH_EXIT%"=="0" pause
exit /b %BAOZHI_LAUNCH_EXIT%
:interactive
echo.
if not "%BAOZHI_LAUNCH_EXIT%"=="0" goto interactive_error
echo The service address is shown above and saved in data\server.url.
echo If the browser did not open, copy that address into your browser.
goto interactive_pause
:interactive_error
echo Startup failed. Please keep the error message above for troubleshooting.
:interactive_pause
echo Press any key to close this launcher window.
pause >nul
exit /b %BAOZHI_LAUNCH_EXIT%
