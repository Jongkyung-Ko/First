@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Stock Picks 탭 갱신일 없을 때 - 표시·버튼 높이 통일 (v83)"
