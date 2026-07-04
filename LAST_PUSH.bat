@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Harm 코드 작곡·스트링 반주·드럼·프리셋·저장 (v198)"
