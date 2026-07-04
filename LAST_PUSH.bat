@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "chore: 기술 전략 7개 스냅샷 빌드·보유일 수익률 백필 (v166)"
