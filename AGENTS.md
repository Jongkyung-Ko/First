# Digital World — Agent workflow

## GitHub 배포 (필수)

코드 변경 후 **항상** `LAST_PUSH.bat`을 갱신하고, 사용자가 더블클릭해 GitHub에 반영합니다.  
PowerShell `.ps1`은 사용하지 않습니다 — **bat만** 사용합니다.

### 사용자: GitHub 반영 (가장 쉬움)

1. `C:\AI_PJT\Digital_Wrold\LAST_PUSH.bat` **더블클릭**  
   또는 `푸시.bat` 더블클릭

### PowerShell

```powershell
cmd /c "C:\AI_PJT\Digital_Wrold\LAST_PUSH.bat"
```

`GIT_PUSH.bat`만 입력하면 **인식되지 않습니다.**

### cmd

```cmd
cd /d C:\AI_PJT\Digital_Wrold
LAST_PUSH.bat
```

### Agent 규칙

작업 완료 시 `LAST_PUSH.bat` 안의 커밋 메시지를 이번 변경에 맞게 수정합니다.

- 사이트: https://jongkyung-ko.github.io/First/
- 원격: https://github.com/Jongkyung-Ko/First.git

## 주요 경로

- `index.html` — UI, 스타일, 페이지 라우팅
- `js/games.js`, `js/games-extra.js`, `js/game-*.js` — 게임
- `js/stock.js`, `js/digimon.js`, `js/auth.js` — 주식·Digi-Mon·인증
- `js/music.js`, `backend/music_service.py` — Music (Jamendo·Openverse)
- `docs/MUSIC_API_KEYS.md` — Music API 키 발급 안내
