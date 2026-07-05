@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Harm 베이스 SoundFont·볼륨·드럼 8마디 필 강화 (v216)"
