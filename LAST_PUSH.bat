@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 가입 DM 1000·Admin 미확인 ID 삭제·메뉴 Log Out (v216)"
