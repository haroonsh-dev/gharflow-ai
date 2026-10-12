import unittest

from app import extract_fields, sniff


class ExtractTests(unittest.TestCase):
    def test_signature(self):
        self.assertEqual(sniff(b"%PDF-1.7"), "application/pdf")
        self.assertIsNone(sniff(b"not an image"))

    def test_conservative_fields(self):
        fields = extract_fields("REFERENCE NO 12345678901234 CURRENT READING 250 PREVIOUS READING 200 UNITS CONSUMED 50 TOTAL AMOUNT 1,234")
        self.assertEqual(fields["reference_number"], "12345678901234")
        self.assertEqual(fields["billed_units"], "50")
        self.assertEqual(fields["total_amount"], "1234")


if __name__ == "__main__":
    unittest.main()
