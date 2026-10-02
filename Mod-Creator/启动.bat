@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 口袋修仙 Mod 制作器 - 本地服务器

set "ROOT=%~dp0"
set "PORT=%~1"
set "PY="

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py -3"
) else (
  where python >nul 2>nul
  if !errorlevel!==0 (
    set "PY=python"
  )
)

if not defined PY (
  echo [错误] 未找到 Python 3。
  echo.
  echo 请先安装 Python 3（https://www.python.org/downloads/），安装时勾选 "Add python.exe to PATH"。
  echo 或者用任意静态服务器手动打开本目录下的 index.html。
  echo.
  pause
  exit /b 1
)

if "%~1"=="" (
  for %%P in (8765 8766 8767 8768 8769 8770 8771 8772 8773 8774 8775) do (
    netstat -ano -p tcp | findstr /c:":%%P " | findstr /c:"LISTENING" >nul
    if errorlevel 1 (
      set "PORT=%%P"
      goto :found
    )
  )
  echo [错误] 端口 8765-8775 均被占用。
  echo 用法: 启动.bat [端口]
  echo.
  pause
  exit /b 1
)

:found
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

start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:%PORT%/index.html'"

cd /d "%ROOT%"
%PY% -m http.server %PORT% --bind 127.0.0.1

echo.
echo 服务器已停止。
pause
