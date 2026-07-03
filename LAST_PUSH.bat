@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: 장기추천로직 탭 — 3전략 청크스캔·100건 이력·PER/ROE/PBR/배당 설명 통합 (v96)"
