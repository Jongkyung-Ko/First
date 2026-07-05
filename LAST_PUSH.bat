@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 감성뉴스 탭 진입 시 자동 live 제거 · Re만 실시간 (v202)"
