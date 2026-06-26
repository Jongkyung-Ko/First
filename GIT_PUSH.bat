@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "LOG=%~dp0GIT_PUSH_RESULT.txt"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=Update Digital World project files."
) else (
  set "COMMIT_MSG=%~1"
)

> "%LOG%" echo === GIT PUSH START ===
>> "%LOG%" echo Commit message: %COMMIT_MSG%
>> "%LOG%" echo.

echo [1/6] git fetch origin
git fetch origin >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [2/6] git status
git status -sb >> "%LOG%" 2>&1
git diff --stat >> "%LOG%" 2>&1
>> "%LOG%" echo.

echo [3/6] git add -A
git add -A >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [4/6] git commit
git commit -m "%COMMIT_MSG%" >> "%LOG%" 2>&1

echo [5/6] git pull --rebase origin %BRANCH%
git pull --rebase origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [6/6] git push origin %BRANCH%
git push -u origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 goto fail

>> "%LOG%" echo.
>> "%LOG%" echo DONE
git rev-parse HEAD >> "%LOG%" 2>&1
git status -sb >> "%LOG%" 2>&1

echo.
echo ========================================
echo  SUCCESS - GitHub push complete
echo ========================================
git log -3 --oneline
git status -sb
echo.
echo Log: GIT_PUSH_RESULT.txt
echo Site: https://jongkyung-ko.github.io/First/
echo.
pause
exit /b 0

:fail
>> "%LOG%" echo.
>> "%LOG%" echo FAILED
git status -sb >> "%LOG%" 2>&1

echo.
echo ========================================
echo  FAILED
echo ========================================
echo Check GIT_PUSH_RESULT.txt
echo.
echo Manual fix:
echo   cd /d "%~dp0"
echo   git fetch origin
echo   git pull --rebase origin main
echo   git push -u origin main
echo.
pause
exit /b 1
