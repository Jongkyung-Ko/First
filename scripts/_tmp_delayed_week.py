import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(r"C:/AI_PJT/Digital_Wrold/data")
STRATS = [
    ("golden-cross", "stock-strategy-golden.json"),
    ("bollinger", "stock-strategy-bollinger.json"),
    ("candle-support", "stock-strategy-candle-support.json"),
    ("vcp", "stock-strategy-vcp.json"),
]
MARKETS = ["kospi", "kosdaq", "nasdaq", "nyse"]
cutoff = (datetime.now().date() - timedelta(days=7)).isoformat()
print("Period: signalDate >=", cutoff, "(last 7 calendar days)")
print("Model: delayed entry = next trading day close after signal; N-day = sell at signal+(N+1) trading day close")
print()

def delayed_returns(sig):
    c0 = sig.get("close")
    if c0 is None or float(c0) == 0:
        return None
    c0 = float(c0)
    c1 = sig.get("nextClose")
    if c1 is None:
        return None
    c1 = float(c1)
    exits = {1: c1}
    for n in range(2, 5):
        h = sig.get(f"holdDay{n}ReturnPct")
        if h is None:
            return None
        exits[n] = c0 * (1 + float(h) / 100)
    out = {}
    for n in (1, 2, 3):
        exit_p = exits.get(n + 1)
        if exit_p is None:
            return None
        out[n] = round((exit_p / c1 - 1) * 100, 4)
    return out

def immediate_returns(sig):
    c0 = float(sig.get("close") or 0)
    if not c0:
        return None
    out = {}
    for n in (1, 2, 3):
        h = sig.get(f"holdDay{n}ReturnPct")
        if h is None:
            return None
        out[n] = float(h)
    return out

for sid, fname in STRATS:
    path = ROOT / fname
    if not path.exists():
        continue
    d = json.loads(path.read_text(encoding="utf-8"))
    for region, keys in [("KR", ["kospi", "kosdaq"]), ("US", ["nasdaq", "nyse"])]:
        imm_s = {1: 0.0, 2: 0.0, 3: 0.0}
        del_s = {1: 0.0, 2: 0.0, 3: 0.0}
        imm_c = {1: 0, 2: 0, 3: 0}
        del_c = {1: 0, 2: 0, 3: 0}
        total_sigs = 0
        for mk in keys:
            for sig in (d.get("markets") or {}).get(mk, {}).get("recentSignals") or []:
                sd = str(sig.get("signalDate") or "")[:10]
                if not sd or sd < cutoff:
                    continue
                total_sigs += 1
                imm = immediate_returns(sig)
                dl = delayed_returns(sig)
                if imm:
                    for n in (1, 2, 3):
                        imm_s[n] += imm[n]
                        imm_c[n] += 1
                if dl:
                    for n in (1, 2, 3):
                        del_s[n] += dl[n]
                        del_c[n] += 1
        print(f"=== {sid} | {region} | signals in window: {total_sigs} ===")
        print(f"  {'':8} {'immediate (current)':>22} {'delayed (+1d buy)':>22}")
        for n in (1, 2, 3):
            i_sum = imm_s[n]
            d_sum = del_s[n]
            ic, dc = imm_c[n], del_c[n]
            i_str = f"{i_sum:+.1f}% (n={ic})" if ic else "n/a"
            d_str = f"{d_sum:+.1f}% (n={dc})" if dc else "n/a"
            print(f"  {n}day     {i_str:>22} {d_str:>22}")
        print()
