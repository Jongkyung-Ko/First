@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "LOG=GIT_PUSH_RESULT.txt"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=Deploy Digital World updates (%DATE% %TIME%)"
) else (
  set "COMMIT_MSG=%~1"
)

echo.
echo === Digital World Git Push ===
echo  Folder: %CD%
echo  Message: %COMMIT_MSG%
echo.
echo  PowerShell에서 bat만 입력하면 안 됩니다. 아래 중 하나를 사용하세요:
echo    cmd /c "%~f0" "메시지"
echo    %~f0
echo    LAST_PUSH.bat  (더블클릭)
echo.

echo [1/6] git fetch origin
git fetch origin
if errorlevel 1 goto fail

echo [2/6] git add and commit
git add -A
git reset HEAD "%LOG%" 2>nul
git reset HEAD GITHUB_PUSH_LOG.txt _push_once_log.txt agent_push_log.txt 2>nul
git rm --cached -f "%LOG%" 2>nul
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 goto fail
) else (
  echo      no new changes to commit
)

echo [3/6] clean working tree
git checkout -- "%LOG%" 2>nul
if exist "%LOG%" attrib -r "%LOG%" >nul 2>&1

echo [4/6] git pull --rebase origin %BRANCH%
git pull --rebase origin %BRANCH%
if errorlevel 1 goto fail

echo [5/6] git push origin %BRANCH%
git push -u origin %BRANCH%
if errorlevel 1 goto fail

echo [6/6] write log
> "%LOG%" echo === GIT PUSH SUCCESS ===
git log -3 --oneline >> "%LOG%" 2>&1
git status -sb >> "%LOG%" 2>&1

echo.
echo ========================================
echo  SUCCESS
echo ========================================
git log -3 --oneline
git status -sb
echo.
echo Site: https://jongkyung-ko.github.io/First/
echo.
if not defined NOPAUSE pause
exit /b 0

:fail
> "%LOG%" echo === GIT PUSH FAILED ===
git status -sb >> "%LOG%" 2>&1

echo.
echo ========================================
echo  FAILED  (see %LOG%)
echo ========================================
type "%LOG%"
echo.
echo Fix then run again:
echo   LAST_PUSH.bat
echo   or  cmd /c "%~f0" "커밋 메시지"
echo.
pause
exit /b 1
