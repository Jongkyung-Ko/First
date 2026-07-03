@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "style: 모바일 하단 페이지 타이틀 정리·탭 네모 스타일 (v76)"
