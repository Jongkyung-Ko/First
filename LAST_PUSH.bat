@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Music 전체화면 버튼을 플레이어 주요 버튼 옆으로 이동 (v90)"
