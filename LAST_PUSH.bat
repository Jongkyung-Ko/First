@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "refactor: 장기 3전략 탭 분리·가이드 배경 설명·탭별 100건 이력 (v97)"
