@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: fundamentals 추천 이력 API 타임아웃·history 병합 (v156)"
