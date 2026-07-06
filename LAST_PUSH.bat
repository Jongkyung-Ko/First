@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 바닥매집 스캔 중 캐시 표시 — 골든크로스와 동일 (v251)"
