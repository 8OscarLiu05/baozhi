@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 -X utf8 launch.py
  goto done
)
where python.exe >nul 2>nul
if not errorlevel 1 (
  python -X utf8 launch.py
  goto done
)
echo 请先安装 Python 3.11 或更新版本，并勾选 Add python.exe to PATH。
pause
exit /b 1
:done
if errorlevel 1 pause
