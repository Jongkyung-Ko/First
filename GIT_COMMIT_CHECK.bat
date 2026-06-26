@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [1/5] 현재 폴더
cd
echo.

echo [2/5] 변경 파일 목록 (git status)
git status -sb
echo.
git status --short
echo.

echo [3/5] 스테이징 (git add -A)
git add -A
git status --short
echo.

echo [4/5] 커밋 (git commit)
git commit -m "Add Digi-Mon, Stock Picks, game costs, and API fixes."
echo commit exit code: %ERRORLEVEL%
echo.

echo [5/5] 최신 커밋 확인
git log -1 --oneline
echo.

set /p PUSH=GitHub에 push 하시겠습니까? (Y/N): 
if /i "%PUSH%"=="Y" (
  git push -u origin main
  echo push exit code: %ERRORLEVEL%
  echo.
  git log -1 --oneline
  git status -sb
)

echo.
echo === 끝 ===
echo git log 가 여전히 8a6680c 이면:
echo   - 위에 빨간/초록 파일이 보였는지 확인
echo   - commit exit code 가 0 인지 확인
echo   - "nothing to commit" 이 나왔는지 확인
pause
