#!/usr/bin/env python3
"""Generate VAPID keys for Web Push. Paste into Render env (never commit private key)."""

from py_vapid import Vapid

vapid = Vapid()
vapid.generate_keys()

print("VAPID_PUBLIC_KEY=")
print(vapid.public_key.decode() if isinstance(vapid.public_key, bytes) else vapid.public_key)
print()
print("VAPID_PRIVATE_KEY=")
print(vapid.private_key.decode() if isinstance(vapid.private_key, bytes) else vapid.private_key)
print()
print('VAPID_SUBJECT=mailto:master@digitalworld.local')
