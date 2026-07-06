@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "chore: Render Starter 전환 — ART 콜드스타트 우회 제거 (v244)"
