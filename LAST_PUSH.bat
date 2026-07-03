@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Stock Picks 갱신일 localStorage 유지 — 프론트 업데이트 후에도 보존 (v94)"
