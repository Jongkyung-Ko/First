@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 한국화 Wikimedia 이미지 URL 404 수정 — 검증된 Commons URL (v242)"
