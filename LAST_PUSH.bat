@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 단기추천로직 탭 정보 업데이트 시점 접이식 표 추가 (v206)"
