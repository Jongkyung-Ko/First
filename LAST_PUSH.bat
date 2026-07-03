@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Dino 복원 그림만 표시 + Pixabay 이미지 디스크 캐시 (v112)"
