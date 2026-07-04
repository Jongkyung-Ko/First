@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Tour 페이지 신설 — Supabase 캐시·일일 cron·Unsplash/Pexels/Pixabay (v191)"
