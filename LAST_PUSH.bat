@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Harm 원곡 멜로디 전사·재생 (재즈 스탠더드 4곡, v223)"
