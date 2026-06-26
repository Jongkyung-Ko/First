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

echo [1/7] git fetch origin
git fetch origin >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [2/7] git add (log file excluded)
git add -A >> "%LOG%" 2>&1
git reset HEAD GIT_PUSH_RESULT.txt >> "%LOG%" 2>&1
git status -sb >> "%LOG%" 2>&1
git diff --cached --stat >> "%LOG%" 2>&1
>> "%LOG%" echo.

echo [3/7] git commit
git diff --cached --quiet >> "%LOG%" 2>&1
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%" >> "%LOG%" 2>&1
) else (
  >> "%LOG%" echo NOTE: no staged changes to commit.
)

echo [4/7] clean log file before rebase
git checkout -- GIT_PUSH_RESULT.txt >> "%LOG%" 2>&1
if exist "%LOG%" del /f /q "%LOG%" >nul 2>&1
> "%LOG%" echo === GIT PUSH (after commit) ===

echo [5/7] git pull --rebase origin %BRANCH%
git pull --rebase origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [6/7] git push origin %BRANCH%
git push -u origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo [7/7] done
git log -3 --oneline >> "%LOG%" 2>&1
git status -sb >> "%LOG%" 2>&1
>> "%LOG%" echo DONE

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
echo If rebase failed, try manually:
echo   cd /d "%~dp0"
echo   git checkout -- GIT_PUSH_RESULT.txt
echo   git pull --rebase origin main
echo   git push -u origin main
echo.
pause
exit /b 1
