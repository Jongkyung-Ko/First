@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 단기추천 14일·일별 표 폰트·sticky·숫자 bold 해제 (v190)"
