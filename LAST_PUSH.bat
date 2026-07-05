@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: 스냅샷 Render·Supabase 동기화 강화 — 최신 payload 보존 (v209)"
