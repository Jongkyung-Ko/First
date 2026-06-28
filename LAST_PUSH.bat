@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: 격자 좌표 LCC 공식 fallback으로 날씨 변환 오류 수정"
