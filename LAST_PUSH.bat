@echo off
REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: 스캔 중 Re는 토스트만·장시간 스캔 안내 개선"
