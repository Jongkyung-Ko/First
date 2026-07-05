@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: harm-theory.js 구문 오류로 이론 섹션 미표시 수정 (v225)"
