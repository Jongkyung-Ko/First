@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Harm 마디 좌→우 배치·재즈 프리셋·작곡목록 접기·이론 강좌 (v212)"
