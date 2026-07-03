@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 장기 3전략별 순위 분리·추천율 4%% 상한·이력 필터 (v99)"
