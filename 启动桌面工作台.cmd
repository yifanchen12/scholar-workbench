@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.12 或更新的受维护版本，再重新双击启动。
  pause
  exit /b 1
)
node scripts\launch-desktop.cjs
if errorlevel 1 pause
