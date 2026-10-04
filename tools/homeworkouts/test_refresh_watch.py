"""refresh_watch's one decision: answer a request only when it is new and recent.
Run: python3 -m unittest tools/homeworkouts/test_refresh_watch.py"""
import calendar
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refresh_watch as rw  # noqa: E402

REQ = '2026-10-03T21:50:00.000Z'
T = calendar.timegm((2026, 10, 3, 21, 50, 0, 0, 0, 0))


class ToAnswer(unittest.TestCase):
    def test_parses_server_iso_as_utc(self):
        self.assertEqual(rw.parse_iso(REQ), T)
        self.assertIsNone(rw.parse_iso('nope'))
        self.assertIsNone(rw.parse_iso(None))

    def test_new_recent_request_is_answered(self):
        self.assertTrue(rw.to_answer(REQ, None, T + 20))
        self.assertTrue(rw.to_answer(REQ, '2026-10-03T21:40:00.000Z', T + 20))

    def test_handled_once(self):
        self.assertFalse(rw.to_answer(REQ, REQ, T + 20))
        self.assertFalse(rw.to_answer('2026-10-03T21:40:00.000Z', REQ, T + 20), 'older than the last handled')

    def test_no_request_or_stale_request(self):
        self.assertFalse(rw.to_answer(None, None, T))
        self.assertFalse(rw.to_answer(REQ, None, T + rw.MAX_AGE_S + 1), 'the Mac slept through it')


if __name__ == '__main__':
    unittest.main()
