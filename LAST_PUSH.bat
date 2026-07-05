@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Poem 카드·낭송 OFF·속도 유지·남성음성 수정 (v232)"
