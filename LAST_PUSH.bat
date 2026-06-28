@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: Fun 로또 탭 표시 — SW JS 캐시 갱신 및 탭 가로 스크롤"
