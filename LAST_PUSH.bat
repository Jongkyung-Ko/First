@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 우주 APOD 사진 깨짐 — 캐시 갱신 race·NASA URL fallback (v243)"
