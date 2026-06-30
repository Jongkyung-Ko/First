#!/usr/bin/env python3
"""Grant Digi-Mon via master login + Render API (no service role key locally)."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

from supabase import create_client

SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk"
)
MASTER_EMAIL = "master@digitalworld.local"
MASTER_PASSWORD = "123456"
API_BASE = "https://first-stock-api.onrender.com"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="mapsro79@naver.com")
    parser.add_argument("--amount", type=int, default=10000)
    parser.add_argument("--reason", default="관리자 충전")
    parser.add_argument("--api", default=API_BASE)
    args = parser.parse_args()

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    auth = client.auth.sign_in_with_password(
        {"email": MASTER_EMAIL, "password": MASTER_PASSWORD}
    )
    token = auth.session.access_token if auth.session else None
    if not token:
        print("Master login failed", file=sys.stderr)
        sys.exit(1)

    qs = urllib.parse.urlencode(
        {"email": args.email, "amount": str(args.amount), "reason": args.reason}
    )
    url = f"{args.api.rstrip('/')}/api/master/grant-digimon?{qs}"
    req = urllib.request.Request(
        url,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode())
            print(json.dumps(body, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        print(f"HTTP {exc.code}: {detail}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
