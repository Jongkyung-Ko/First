@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Music UI 정리 — 장르탭 통일·테마선택·페이지네이션·목록 간격 (v85)"
