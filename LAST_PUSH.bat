@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Music 목록 전체추가·전체화면 비주얼+플레이어 (v89)"
