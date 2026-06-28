@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "refactor: Fun 별자리 탭 분리, 운세 탭에 오늘의 운세 바로 표시"
