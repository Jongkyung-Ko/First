@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 마법공식 NASDAQ 최근 추천 100건과 현재 수익률 표시 (v270)"
