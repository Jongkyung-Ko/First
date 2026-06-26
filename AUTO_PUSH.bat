@echo off
chcp 65001 >nul
cd /d "%~dp0"

set LOG=%~dp0GIT_PUSH_RESULT.txt
echo === GIT PUSH %date% %time% ===> "%LOG%"

echo.>> "%LOG%"
git status -sb>> "%LOG%" 2>&1
echo.>> "%LOG%"
git diff --stat>> "%LOG%" 2>&1
echo.>> "%LOG%"

git add -A>> "%LOG%" 2>&1
git commit -m "Add live Stock Picks refresh on visit and charge Digi-Mon on manual refresh." >> "%LOG%" 2>&1
git push -u origin main>> "%LOG%" 2>&1

echo.>> "%LOG%"
echo COMMIT:>> "%LOG%"
git rev-parse HEAD>> "%LOG%" 2>&1
echo BRANCH:>> "%LOG%"
git branch --show-current>> "%LOG%" 2>&1
echo STATUS:>> "%LOG%"
git status -sb>> "%LOG%" 2>&1
echo DONE>> "%LOG%"
