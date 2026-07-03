@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Supabase 전역 스냅샷 — 전 사용자 공통 최신 Stock Picks 데이터 공유 (v95)"
