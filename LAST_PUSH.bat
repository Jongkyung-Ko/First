@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Tour 매일 16시 이미지 서버 캐시 자동 갱신 (v263)"
