@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "fix: ART 썸네일 제거 원복·메인 캔버스 선택·로딩바 위치"
