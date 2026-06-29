@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: ART 장르 탭 재선택 시 클라이언트 캐시로 즉시 표시"
