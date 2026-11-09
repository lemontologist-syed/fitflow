@echo off
REM Generates the FitFlow VAPID keys and cron secret (needs Node.js). Nothing is saved to disk.
cd /d "%~dp0"
node scripts\generate-keys.mjs
pause
