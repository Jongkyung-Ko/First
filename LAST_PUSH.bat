@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: RSI·지지캔들·OBV·쌍삼중바닥·VCP 활용 가이드 (v189)"
