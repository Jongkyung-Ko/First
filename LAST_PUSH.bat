@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 단기추천로직 갱신 시각표 간소화 · 전략 마지막 갱신 KST 표시 (v207)"
