import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from PIL import Image
from app import extract_fields, sniff, candidates_from_tsv, process_document


class ExtractTests(unittest.TestCase):
    def test_signature(self):
        self.assertEqual(sniff(b'%PDF-1.7'), 'application/pdf')
        self.assertIsNone(sniff(b'not an image'))

    def test_fields(self):
        fields = extract_fields('REFERENCE NO 12345678901234 CURRENT READING 250 PREVIOUS READING 200 UNITS CONSUMED 50 TOTAL AMOUNT 1,234 READING DATE 15-AUG-2026 DUE DATE 25-AUG-2026 TARIFF A-1A')
        self.assertEqual(fields['reference_number'], '12345678901234')
        self.assertEqual(fields['total_amount'], '1234')
        self.assertEqual(fields['reading_date'], '2026-08-15')
        self.assertEqual(fields['due_date'], '2026-08-25')
        self.assertEqual(fields['tariff'], 'A-1A')
        self.assertEqual(extract_fields('REFERENCE NO 12345678901 234')['reference_number'], '12345678901234')

    def test_ke_account_number(self):
        # K-Electric 13-digit consumer account number
        fields = extract_fields('ACCOUNT NO 0400012345678 NET PAYABLE 4,500')
        self.assertEqual(fields['reference_number'], '0400012345678')
        self.assertEqual(fields['total_amount'], '4500')

    def test_ptcl_bill(self):
        # PTCL Broadband 10-digit account ID and line-item charges
        raw = 'ACCOUNT ID 1000123456 MONTHLY CHARGES 3,500 SALES TAX 682.50 WITHHOLDING TAX 525.00 ARREARS 0 AMOUNT PAYABLE 4,707.50'
        fields = extract_fields(raw)
        self.assertEqual(fields['reference_number'], '1000123456')
        self.assertEqual(fields['package_charges'], '3500')
        self.assertEqual(fields['sales_tax'], '682.50')
        self.assertEqual(fields['wht_tax'], '525.00')
        self.assertEqual(fields['arrears'], '0')
        self.assertEqual(fields['total_amount'], '4707.50')

    def test_candidate_region_uses_value_tokens(self):
        header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
        tsv = header + '5\t1\t1\t1\t1\t1\t10\t20\t30\t10\t90\tCURRENT\n5\t1\t1\t1\t1\t2\t45\t20\t30\t10\t80\tREADING\n5\t1\t1\t1\t1\t3\t80\t20\t20\t10\t75\t250\n'
        candidate = candidates_from_tsv(tsv, 2, 200, 100)['current_reading']
        self.assertEqual(candidate['value'], '250')
        self.assertEqual(candidate['page'], 2)
        self.assertEqual(candidate['confidence'], 75)
        self.assertEqual(candidate['box'], {'x': .4, 'y': .2, 'width': .1, 'height': .1})

    def test_camera_orientation_survives_memory_bounded_preview(self):
        source = Image.new('RGB', (75, 50), 'white')
        exif = Image.Exif()
        exif[274] = 6  # A camera image displayed rotated clockwise.
        encoded = io.BytesIO()
        source.save(encoded, 'JPEG', exif=exif)
        with patch('app.subprocess.run', return_value=SimpleNamespace(stdout='level\ttext\n')):
            result = process_document(encoded.getvalue(), 'image/jpeg')
        self.assertEqual(result['pages'][0]['width'], 50)
        self.assertEqual(result['pages'][0]['height'], 75)
        self.assertEqual(result['fields'], {})


if __name__ == '__main__':
    unittest.main()
