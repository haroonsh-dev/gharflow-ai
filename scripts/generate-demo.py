"""Generate explicitly synthetic documents for the repeatable demo; no real account data."""
from pathlib import Path

def pdf(lines):
    def escape(text): return text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
    stream='BT /F1 15 Tf 50 790 Td '+ ' '.join(f'({escape(line)}) Tj 0 -34 Td' for line in lines)+' ET'
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',f'<< /Length {len(stream.encode())} >>\nstream\n{stream}\nendstream'.encode()]
    result=b'%PDF-1.4\n';offsets=[0]
    for index,obj in enumerate(objects,1): offsets.append(len(result));result+=f'{index} 0 obj\n'.encode()+obj+b'\nendobj\n'
    start=len(result);result+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    for offset in offsets[1:]:result+=f'{offset:010} 00000 n \n'.encode()
    result+=f'trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode()
    return result
root=Path(__file__).resolve().parents[1]/'demo'
root.mkdir(exist_ok=True)
for name,previous,current,units,amount,date in [('normal',1000,1100,100,5000,'2026-08-10'),('discrepancy',1100,1220,160,7000,'2026-09-10')]:
    (root/f'{name}.pdf').write_bytes(pdf(['SYNTHETIC GHARFLOW DEMONSTRATION','NOT A REAL LESCO BILL','REFERENCE NO 12345678901234','METER NO DEMO-01',f'READING DATE {date}',f'PREVIOUS READING {previous}',f'CURRENT READING {current}',f'UNITS CONSUMED {units}',f'TOTAL AMOUNT {amount}','These values are demonstration fixtures.']))
(root/'unreadable.pdf').write_bytes(pdf(['SYNTHETIC UNREADABLE DOCUMENT','No supported bill fields in this demonstration.','Use manual entry to recover.']))
