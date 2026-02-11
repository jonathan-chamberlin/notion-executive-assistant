@echo off
REM Wrapper for kalshi-cron.js — called by Windows Task Scheduler
REM Usage: kalshi-cron.bat [scan|usage|summary|status]

cd /d "C:\Repositories for Git\notion-executive-assistant-folder"
node scripts/kalshi-cron.js %1 >> "%TEMP%\kalshi-cron.log" 2>&1
