@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 장기추천 설명 접기·4시장 집계·TOP100 수치순 (v106)"
