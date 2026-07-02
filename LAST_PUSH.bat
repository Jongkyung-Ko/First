@echo off
REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: Re 스캔 경과시간 서버 startedAt 기준·폴링 시 타이머 리셋 방지"
