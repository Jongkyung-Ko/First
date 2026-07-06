@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Re 안정화 — meta 재합류·청크스캔·열린시장·병렬스캔 (v247)"
