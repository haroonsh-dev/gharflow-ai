"""Evaluate a declared held-out manifest. No dataset or metric is invented."""
import argparse
import json
import time
from pathlib import Path
from app import process_document,sniff
parser=argparse.ArgumentParser()
parser.add_argument('manifest',help='JSON manifest of held-out redacted documents')
parser.add_argument('--output',required=True)
args=parser.parse_args()
manifest_path=Path(args.manifest).resolve()
manifest=json.loads(manifest_path.read_text())
if manifest.get('split')!='held_out' and not (manifest.get('split')=='pipeline_fixture' and manifest.get('synthetic') is True):raise SystemExit('Declare split=held_out for unseen evaluation documents, or pipeline_fixture for synthetic examples.')
if not isinstance(manifest.get('synthetic'),bool):raise SystemExit('Declare synthetic=true or false.')
results=[];correct=total=0;correction_times=[]
for item in manifest['documents']:
    source=(manifest_path.parent/item['file']).resolve()
    data=source.read_bytes();mime=sniff(data)
    if not mime:raise SystemExit(f'Unsupported signature: {source.name}')
    if len(data)>8*1024*1024:raise SystemExit('Document exceeds size limit')
    started=time.monotonic()
    try:fields=process_document(data,mime)['fields'];error=None
    except Exception as exc:fields={};error=type(exc).__name__
    checks={key:str(fields.get(key,''))==str(value) for key,value in item['expected'].items()}
    correct+=sum(checks.values());total+=len(checks)
    if 'correction_seconds' in item:
        value=float(item['correction_seconds'])
        if value<0:raise SystemExit('correction_seconds must be a measured nonnegative duration')
        correction_times.append(value)
    results.append({'file':item['file'],'checks':checks,'seconds':round(time.monotonic()-started,3),'error':error})
report={'dataset':manifest['name'],'split':manifest['split'],'synthetic':manifest['synthetic'],'documents':len(results),'correct_fields':correct,'evaluated_fields':total,'exact_field_accuracy':correct/total if total else None,'mean_measured_correction_seconds':sum(correction_times)/len(correction_times) if correction_times else None,'correction_time_samples':len(correction_times),'results':results,'limits':'These figures apply only to this declared dataset, not all LESCO bills.'}
Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
