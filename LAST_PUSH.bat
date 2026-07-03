@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 단기·장기 허브 탭 강조·수익률표 PER등 제거 (v104)"
