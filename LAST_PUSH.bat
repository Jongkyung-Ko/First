@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 단기추천 N일차 표·Stock Picks 탭 글자 크기 정리 (v186)"
