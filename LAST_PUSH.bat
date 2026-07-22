@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 단기추천 장중 Re를 현재가·수익률 빠른 갱신으로 개선 (v269)"
