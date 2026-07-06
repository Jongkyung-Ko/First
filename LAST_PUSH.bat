@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 주식 API 스캔 즉시 로딩 배너·탭 동기화·폴링 단축 (v257)"
