@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 골든크로스 활용 가이드 버튼을 타이틀 옆으로 이동 (v182)"
