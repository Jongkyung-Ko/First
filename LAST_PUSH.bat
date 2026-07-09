@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: Music 장르 목록 Failed to fetch 완화 — abort/retry·캐시·병렬 (v265)"
