@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 단기추천 Re 마스터 전용 · A+B 갱신일 · prefetch (v203)"
