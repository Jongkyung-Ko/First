@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "perf: ART PWA 즉시 그림 표시·앱 시작 시 명작 프리페치"
