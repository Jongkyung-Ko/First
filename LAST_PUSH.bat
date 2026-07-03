@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Dino 탭 — 백악기·쥬라기 공룡 20종 갤러리 (v109)"
