"""Unit tests for the build-time dataset generators (tools/gen_*.py).

Standard-library only (unittest). Exercises the pure helper functions without
writing output files or hitting the network.

Run:  python3 -m unittest discover -s tests/python -p '*_test.py'
"""
import os
import sys
import tempfile
import unittest

# Make tools/ importable.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import gen_chardata  # noqa: E402
import gen_homoglyphs  # noqa: E402


class TestRangeParsing(unittest.TestCase):
    def test_parse_ranges_single_and_span(self):
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("# comment\n")
            f.write("0041; Latin\n")
            f.write("0400..04FF ; Cyrillic # note\n")
            path = f.name
        try:
            ranges = gen_chardata.parse_ranges(path)
        finally:
            os.unlink(path)
        self.assertEqual(ranges[0], (0x41, 0x41, "Latin"))
        self.assertEqual(ranges[1], (0x400, 0x4FF, "Cyrillic"))

    def test_lookup_hits_and_misses(self):
        ranges = [(0, 0x7F, "ASCII"), (0x400, 0x4FF, "Cyrillic")]
        self.assertEqual(gen_chardata.lookup(ranges, 0x41, "?"), "ASCII")
        self.assertEqual(gen_chardata.lookup(ranges, 0x430, "?"), "Cyrillic")
        self.assertEqual(gen_chardata.lookup(ranges, 0x200, "?"), "?")
        # gen_homoglyphs shares the same algorithm
        self.assertEqual(gen_homoglyphs.lookup(ranges, 0x430, "?"), "Cyrillic")


class TestFormulaicDetection(unittest.TestCase):
    def test_is_formulaic(self):
        self.assertTrue(gen_chardata.is_formulaic(0x4E00))   # CJK ideograph
        self.assertTrue(gen_chardata.is_formulaic(0xAC00))   # Hangul syllable
        self.assertFalse(gen_chardata.is_formulaic(0x0041))  # Latin A
        self.assertFalse(gen_chardata.is_formulaic(0x2603))  # Snowman

    def test_category_names_cover_common_codes(self):
        for code in ("Lu", "Ll", "Nd", "So", "Cf", "Zs"):
            self.assertIn(code, gen_chardata.CATEGORY_NAMES)


class TestSkeletonResolution(unittest.TestCase):
    def test_direct_fold(self):
        mapping = {0x430: [0x61]}  # Cyrillic а -> Latin a
        self.assertEqual(gen_homoglyphs.resolve_skeleton(0x430, mapping, {}, set()), "a")

    def test_transitive_chain(self):
        # fullwidth ａ -> Cyrillic а -> Latin a
        mapping = {0xFF41: [0x430], 0x430: [0x61]}
        self.assertEqual(gen_homoglyphs.resolve_skeleton(0xFF41, mapping, {}, set()), "a")

    def test_multi_codepoint_target(self):
        mapping = {0xFB01: [0x66, 0x69]}  # ﬁ ligature -> "fi"
        self.assertEqual(gen_homoglyphs.resolve_skeleton(0xFB01, mapping, {}, set()), "fi")

    def test_cycle_is_handled(self):
        mapping = {0x1: [0x2], 0x2: [0x1]}  # pathological cycle
        out = gen_homoglyphs.resolve_skeleton(0x1, mapping, {}, set())
        self.assertIsInstance(out, str)  # must terminate, not recurse forever

    def test_unmapped_returns_self(self):
        self.assertEqual(gen_homoglyphs.resolve_skeleton(0x61, {}, {}, set()), "a")


class TestConfusablesParsing(unittest.TestCase):
    def test_parse_confusables(self):
        sample = (
            "# Version: 17.0.0\n"
            "0430 ;\t0061 ;\tMA\t# ( а -> a )\n"
            "FB01 ;\t0066 0069 ;\tMA\t# ( fi )\n"
        )
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(sample)
            path = f.name
        try:
            mapping, version = gen_homoglyphs.parse_confusables(path)
        finally:
            os.unlink(path)
        self.assertEqual(version, "17.0.0")
        self.assertEqual(mapping[0x430], [0x61])
        self.assertEqual(mapping[0xFB01], [0x66, 0x69])


if __name__ == "__main__":
    unittest.main()
