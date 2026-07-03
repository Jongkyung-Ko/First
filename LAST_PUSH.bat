@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 주식 서브탭 단기·장기 그룹 테두리·갱신시간 폭 고정·전체 너비 (v103)"
