@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 장기추천로직 정적화·스케줄 접기·모바일 테이블 (v154)"
