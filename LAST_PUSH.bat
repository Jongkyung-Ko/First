@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Music 목록 줄간격·맨끝 페이지 실제 마지막+토스트 (v87)"
