@echo off

REM Agent가 수정한 뒤 사용자가 더블클릭해 GitHub에 반영합니다.

cd /d "%~dp0"

call "%~dp0GIT_PUSH.bat" "fix: ART 정물화 갤러리 20작품 보장·AIC 장르 검색 수정 (v227)"
