@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: Chart 메뉴 — KOSPI/KOSDAQ/NYSE/NASDAQ 시총 TOP10·일봉 차트·보조지표"
