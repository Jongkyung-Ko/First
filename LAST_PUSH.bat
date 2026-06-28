@echo off
REM Agent가 작업 후 이 파일을 갱신합니다. 더블클릭하면 GitHub에 반영됩니다.
cd /d "%~dp0"
call "%~dp0GIT_PUSH.bat" "feat: 우주 APOD 한글 번역·영상 임베드·요청 버튼으로 5장 추가 로드"
