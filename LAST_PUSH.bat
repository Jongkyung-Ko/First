@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: Stock 전략 TOP50 골든크로스·볼린저·RSI (DM1·14일·뉴욕ET)"
