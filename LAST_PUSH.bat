@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: Fun 사실·착시 5개 표시 및 새로고침 랜덤, 명언 탭 제거"
