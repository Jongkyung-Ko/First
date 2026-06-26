@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Digital World - GitHub Upload
echo ========================================
echo.

git status -sb
echo.

git add -A
if errorlevel 1 goto :error

git commit -m "Add Digi-Mon, Stock Picks, game costs, and API fixes."
if errorlevel 1 (
  echo.
  echo [Note] Commit may have failed if there are no changes.
)

echo.
git push -u origin main
if errorlevel 1 goto :error

echo.
echo ========================================
echo  SUCCESS
echo ========================================
git log -1 --oneline
git status -sb
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo  FAILED - check login or network
echo ========================================
echo Try: git push -u origin main
echo.
pause
exit /b 1
