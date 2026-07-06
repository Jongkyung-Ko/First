@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "perf: 장기추천 캐시·프리페치 + 서버 public payload TTL (v245)"
