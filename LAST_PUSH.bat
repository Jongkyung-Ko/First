@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Fundamentals 한국 시장 KST 갱신 표시 + updatedAtKst (v142)"
