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

git add index.html js/digimon.js js/games.js js/stock.js js/leaderboard.js supabase/digimon_setup_all.sql supabase/digimon_history.sql>> "%LOG%" 2>&1
git commit -m "Add Digi-Mon guide to Welcome page and profile history." -m "Document usage and recharge rules on Welcome, log spend/grant reasons, and show transaction history on Profile." >> "%LOG%" 2>&1
git push -u origin HEAD>> "%LOG%" 2>&1

echo.>> "%LOG%"
echo COMMIT:>> "%LOG%"
git rev-parse HEAD>> "%LOG%" 2>&1
echo BRANCH:>> "%LOG%"
git branch --show-current>> "%LOG%" 2>&1
echo STATUS:>> "%LOG%"
git status -sb>> "%LOG%" 2>&1
echo DONE>> "%LOG%"
