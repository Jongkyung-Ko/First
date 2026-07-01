@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: 모바일 우주·ART 전체화면 몰입 모드 (Fullscreen API + fallback)"
