@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
  set "PYTHON=py -3"
) else (
  set "PYTHON=python"
)

if not exist ".env" copy /Y ".env.example" ".env" >nul
if not exist ".venv\Scripts\python.exe" %PYTHON% -m venv .venv || goto :error
call ".venv\Scripts\activate.bat" || goto :error
python -m pip install -r requirements.txt || goto :error

echo Host dependencies installed successfully.
exit /b 0

:error
echo Host setup failed. Install Python 3.11 or newer and try again.
exit /b 1
