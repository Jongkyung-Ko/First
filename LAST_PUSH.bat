@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: KOSPI TOP50 바닥매집(거래량15-30% 2일+SMA5하락) 6개월 분석"
