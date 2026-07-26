"""Tests for fundamentals Re authorization."""

from __future__ import annotations

import unittest

from fundamentals_auth import (
    FUNDAMENTALS_FORCE_EMAIL,
    is_fundamentals_force_user,
    normalize_email,
)


class FundamentalsAuthTests(unittest.TestCase):
    def test_normalize_email(self):
        self.assertEqual(normalize_email("  MasPro79@Naver.COM "), "maspro79@naver.com")

    def test_force_user_allowlist(self):
        self.assertTrue(is_fundamentals_force_user(FUNDAMENTALS_FORCE_EMAIL))
        self.assertFalse(is_fundamentals_force_user("master@digitalworld.local"))
        self.assertFalse(is_fundamentals_force_user("other@example.com"))


if __name__ == "__main__":
    unittest.main()
