@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Re(user_re) 데이터가 정적 JSON보다 우선 — 갱신 시각 롤백 방지 (v258)"
