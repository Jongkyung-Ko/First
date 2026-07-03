@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 단기추천 일치율 표에 수익률 컬럼 통합 (v118)"
