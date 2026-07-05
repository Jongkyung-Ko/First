@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Stock Picks Re 클라이언트 락·탭 복귀 로딩·reject 토스트 (v201)"
