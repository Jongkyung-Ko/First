@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Music 재생 큐 다음 3곡 프리페치로 끊김 없는 연속 재생 (v268)"
