@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: 우주 탭 캐시 즉시 표시 (localStorage + 탭 전환 최적화)"
