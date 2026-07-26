#!/usr/bin/env python3
"""Grant Digi-Mon to a user by email (requires Supabase service role + admin SQL)."""

from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from digimon_admin import grant_digimon_by_email  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant Digi-Mon by email")
    parser.add_argument("--email", default="mapsro79@naver.com", help="User email")
    parser.add_argument("--amount", type=int, default=10000, help="Amount to grant")
    parser.add_argument("--reason", default="관리자 충전", help="History reason")
    args = parser.parse_args()

    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print(
            "SUPABASE_SERVICE_ROLE_KEY is not set.\n"
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run:\n"
            "  supabase/admin_grant_digimon.sql in Supabase SQL Editor (once)",
            file=sys.stderr,
        )
        sys.exit(1)

    result = grant_digimon_by_email(args.email, args.amount, args.reason)
    print(f"OK: {result['email']} +{result['amount']} → balance {result['balance']}")


if __name__ == "__main__":
    main()
