"""Tests for fetch_media.py: the header rebuild and the style choice.

    python3 -m unittest tools/homeworkouts/test_fetch_media.py
"""
import os
import struct
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_media  # noqa: E402


def synthetic_clip(mdat_payload=b'x' * 500, moov_payload=b'm' * 60):
    """A plain MP4-shaped file with the template header, then the CDN's scrambled form of it."""
    mdat = struct.pack('>I4s', 8 + len(mdat_payload), b'mdat') + mdat_payload
    moov = struct.pack('>I4s', 8 + len(moov_payload), b'moov') + moov_payload
    head = bytearray(fetch_media.HEAD_TEMPLATE)
    head[40:44] = struct.pack('>I', 8 + len(mdat_payload))
    plain = bytes(head) + (mdat + moov)[256 - 40:]
    scrambled = b'Q' * fetch_media.SCRAMBLED_LEN + plain[256:]
    return plain, scrambled


class RebuildTests(unittest.TestCase):
    def test_round_trip(self):
        plain, scrambled = synthetic_clip()
        self.assertEqual(fetch_media.rebuild(scrambled), plain)
        self.assertEqual([b[0] for b in fetch_media.walk_boxes(plain)], ['ftyp', 'free', 'mdat', 'moov'])

    def test_bad_tail_fails_loudly(self):
        _, scrambled = synthetic_clip()
        with self.assertRaises(fetch_media.FetchError):
            fetch_media.rebuild(scrambled[:-10])
        with self.assertRaises(fetch_media.FetchError):
            fetch_media.rebuild(b'Q' * 100)

    def test_pick_source_order(self):
        mapping = {
            '1': {'gym': {'men_white': -1}, 'live': {'men_white': 19}, 'bed': {'men_white': 11}},
            '2': {'gym': {'men_white': 2}, 'live': {'men_white': 19}},
            '3': {'gym': {'men_white': -1}, 'live': {'men_white': -1}},
        }
        self.assertEqual(fetch_media.pick_source(mapping, 1), ('live', 19))
        self.assertEqual(fetch_media.pick_source(mapping, '2'), ('gym', 2))
        self.assertIsNone(fetch_media.pick_source(mapping, 3))
        self.assertIsNone(fetch_media.pick_source(mapping, 4))


if __name__ == '__main__':
    unittest.main()
