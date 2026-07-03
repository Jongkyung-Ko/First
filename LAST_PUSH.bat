@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Dino 이미지 프리페치 진행 표시 및 Pixabay 중복 수정 (v123)"
