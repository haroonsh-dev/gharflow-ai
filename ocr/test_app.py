import unittest
from app import extract_fields,sniff,candidates_from_tsv
class ExtractTests(unittest.TestCase):
    def test_signature(self):
        self.assertEqual(sniff(b'%PDF-1.7'),'application/pdf')
        self.assertIsNone(sniff(b'not an image'))
    def test_fields(self):
        fields=extract_fields('REFERENCE NO 12345678901234 CURRENT READING 250 PREVIOUS READING 200 UNITS CONSUMED 50 TOTAL AMOUNT 1,234')
        self.assertEqual(fields['reference_number'],'12345678901234')
        self.assertEqual(fields['total_amount'],'1234')
        self.assertEqual(extract_fields('REFERENCE NO 12345678901 234')['reference_number'],'12345678901234')
    def test_candidate_region_uses_value_tokens(self):
        header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
        tsv=header+'5\t1\t1\t1\t1\t1\t10\t20\t30\t10\t90\tCURRENT\n5\t1\t1\t1\t1\t2\t45\t20\t30\t10\t80\tREADING\n5\t1\t1\t1\t1\t3\t80\t20\t20\t10\t75\t250\n'
        candidate=candidates_from_tsv(tsv,2,200,100)['current_reading']
        self.assertEqual(candidate['value'],'250')
        self.assertEqual(candidate['page'],2)
        self.assertEqual(candidate['confidence'],75)
        self.assertEqual(candidate['box'],{'x':.4,'y':.2,'width':.1,'height':.1})
if __name__=='__main__':unittest.main()
