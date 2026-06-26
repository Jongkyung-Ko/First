# Digital World — Agent workflow

## GitHub 배포 (필수)

코드 변경 후 **항상** GitHub `origin/main`에 커밋·푸시한 뒤 작업을 마칩니다. 로컬만 수정하고 끝내지 않습니다.

```cmd
cd /d C:\AI_PJT\Digital_Wrold
GIT_PUSH.bat "변경 내용 요약 (한글 또는 영문)"
```

- 사이트: https://jongkyung-ko.github.io/First/
- 원격: https://github.com/Jongkyung-Ko/First.git
- `GIT_PUSH.bat`은 `git pull --rebase` 후 `git push`까지 수행합니다.
- 로그 파일(`GIT_PUSH_RESULT.txt` 등)은 커밋하지 않습니다.

## 주요 경로

- `index.html` — UI, 스타일, 페이지 라우팅
- `js/games.js`, `js/games-extra.js`, `js/game-*.js` — 게임
- `js/stock.js`, `js/digimon.js`, `js/auth.js` — 주식·Digi-Mon·인증
