@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 단기 추천 로직 일치율 테이블에 수익률 열 추가 (v264)"
