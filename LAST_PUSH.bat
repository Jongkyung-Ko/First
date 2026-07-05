@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: meta 502 busy 유지 · preflight 실패 UI · loadData 중복 방지 (v205)"
