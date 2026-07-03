@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Fun 메뉴에 매직 아이 탭·전체화면 갤러리 추가 (v91)"
