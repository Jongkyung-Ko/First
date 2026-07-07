@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "chore: 단기 로직 cron 45분 간격 분산·장기 스케줄 조정 (v259)"
