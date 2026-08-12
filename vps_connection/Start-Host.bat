@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo  SubwayThotsHotel Online - VPS World Host
echo  Local endpoint: 127.0.0.1:7076
echo ================================================

if not exist ".venv\Scripts\python.exe" (
  call Setup-Host.bat || goto :error
)

call ".venv\Scripts\activate.bat" || goto :error

echo.
echo Starting Host.py on TCP 7076...
python Host.py
goto :eof

:error
echo.
echo Host failed to start. Run Setup-Host.bat and try again.
pause
exit /b 1
