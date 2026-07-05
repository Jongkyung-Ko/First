@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Harm 작곡 기초 5단계·12키 장음계 듣기 (v224)"
