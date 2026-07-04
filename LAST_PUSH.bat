@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: PER/PBR 미국 주식만 · 국내 탭 비활성 (v147)"
