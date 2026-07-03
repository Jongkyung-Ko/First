@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "ui: 단기추천로직 명칭·장기추천로직 탭 PER 앞 배치·장기 청크 일괄 실행 (v98)"
