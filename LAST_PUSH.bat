@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: 우주·태양계 spectacular 이미지 필터 — Hubble/JWST 우선·도표 제외"
