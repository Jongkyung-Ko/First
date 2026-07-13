@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 바닥매집 Re가 AbortController를 즉시 끊어 항상 실패하던 버그 수정 (v267)"
