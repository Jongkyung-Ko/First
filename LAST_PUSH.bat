@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "docs: 골든크로스 활용 가이드에 승률 환경 설명 추가 (v183)"
