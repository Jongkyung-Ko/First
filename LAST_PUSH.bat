@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Stock Picks nav 갱신시간 제거·페이지 상단 하늘색 표시 (v139)"
