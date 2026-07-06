@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 바닥매집 Re 무반응 — 피드백·Abort·스캔완료 판정 (v250)"
