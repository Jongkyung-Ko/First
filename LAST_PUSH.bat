@echo off
REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: 진입·매집 탭은 T-1 종가 기준 신호만 표시"
