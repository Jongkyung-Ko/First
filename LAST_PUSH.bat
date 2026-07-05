@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "feat: Harm 프리셋 제목·조 표시·1·4·5도 색상·이론 진행 예시 (v214)"
