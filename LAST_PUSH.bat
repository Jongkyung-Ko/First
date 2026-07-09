@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Books 목록 초기 fail·깜빡임 완화, cold start 코드 제거 (v266)"
