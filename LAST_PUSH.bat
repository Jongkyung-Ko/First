@echo off
REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: Re 스캔 중 탭 전환해도 HTTP 유지·전역 meta 상태 표시"
