"""Smoke tests for admin_service (no network)."""

from __future__ import annotations

import unittest

from admin_service import ADMIN_EMAILS, verify_admin_from_bearer


class AdminServiceAuthTest(unittest.TestCase):
    def test_admin_emails_include_maspro(self):
        self.assertIn("maspro79@naver.com", ADMIN_EMAILS)

    def test_verify_requires_bearer(self):
        with self.assertRaises(Exception) as ctx:
            verify_admin_from_bearer(None)
        self.assertEqual(ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
