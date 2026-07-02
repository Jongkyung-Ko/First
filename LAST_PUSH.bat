@echo off
REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: 8시 Push cron 재시도·감성뉴스 당일 trade_date·마지막 발송 표시"
