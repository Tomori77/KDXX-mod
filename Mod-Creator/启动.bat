@echo off
setlocal
chcp 65001 >nul
title 口袋修仙 Mod 制作器 - 本地服务器

set "ROOT=%~dp0"
set "PORT=%~1"
set "PY="

where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo [错误] 未找到 Python 3。
  echo 请安装 Python 3（安装时勾选 Add python.exe to PATH），
  echo 或用任意静态服务器打开本目录下的 index.html。
  echo.
  pause
  exit /b 1
)

if not defined PORT (
  for %%P in (8765 8766 8767 8768 8769 8770 8771 8772 8773 8774 8775) do (
    if not defined PORT (
      netstat -ano -p tcp | findstr /c:":%%P " | findstr LISTENING >nul || set "PORT=%%P"
    )
  )
  if not defined PORT set "PORT=8765"
)

echo ============================================================
echo   口袋修仙 Mod 制作器 - 本地服务器
echo ------------------------------------------------------------
echo   目录: %ROOT%
echo   端口: %PORT%
echo   地址: http://127.0.0.1:%PORT%/index.html
echo.
echo   关闭本窗口即停止服务器。
echo ============================================================
echo.

start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:%PORT%/index.html'"

cd /d "%ROOT%"
%PY% "%ROOT%tools\server.py" --port %PORT% --root "%ROOT%"
echo.
echo 服务器已停止。
pause
