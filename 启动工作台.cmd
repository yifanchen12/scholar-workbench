@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，将直接打开离线工作台。
  start "" "%~dp0index.html"
  exit /b
)
echo 邮研 · 学习工作台
echo 请在浏览器打开 http://127.0.0.1:5179
echo 保留此窗口即可使用；关闭窗口会停止服务。个人数据保存在浏览器。
node server.js --open
pause
