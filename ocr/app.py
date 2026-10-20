from __future__ import annotations
import asyncio
import base64
import csv
import hmac
import io
import os
import re
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import FastAPI, File, Header, HTTPException, UploadFile

app = FastAPI(docs_url=None, redoc_url=None)
MAX_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 12_000_000
slots = asyncio.Semaphore(1)
PATTERNS = {
    "reference_number": r"(?:REFERENCE\s*(?:NO|NUMBER|#)?|CONSUMER\s*(?:NO|ID|#)?|ACCOUNT\s*(?:NO|NUMBER|ID|#)?)[\s:.]*([0-9](?:\s*[0-9]){9,13})(?![0-9])",
    "previous_reading": r"(?:PREVIOUS\s+READING|PREV\s+READING)[\s:.]*([0-9]{1,12}(?:\.[0-9]{1,3})?)",
    "current_reading": r"(?:CURRENT\s+READING|PRESENT\s+READING)[\s:.]*([0-9]{1,12}(?:\.[0-9]{1,3})?)",
    "billed_units": r"(?:UNITS\s+CONSUMED|CONSUMED\s+UNITS|BILLED\s+UNITS|TOTAL\s+UNITS)[\s:.]*([0-9]{1,12}(?:\.[0-9]{1,3})?)",
    "total_amount": r"(?:PAYABLE\s+WITHIN\s+DUE\s+DATE|AMOUNT\s+PAYABLE|TOTAL\s+AMOUNT|NET\s+PAYABLE)[\s:.]*([0-9,]{1,15}(?:\.[0-9]{1,2})?)",
    "meter_identity": r"METER\s*(?:NO|NUMBER|#|SERIAL)[\s:.]*([A-Z0-9-]{1,40})",
    "reading_date": r"(?:READING\s+DATE|METER\s+READING\s+DATE)[\s:.]*(\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{2}-[A-Za-z]{3}-\d{2,4})",
    "due_date": r"DUE\s+DATE[\s:.]*(\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{2}-[A-Za-z]{3}-\d{2,4})",
    "tariff": r"TARIFF[\s:.]*([A-Z0-9()-]{2,20})",
    "package_charges": r"(?:PACKAGE|MONTHLY|BROADBAND)\s+CHARGES[\s:.]*([0-9,]{1,10}(?:\.[0-9]{1,2})?)",
    "wht_tax": r"(?:WITHHOLDING\s+TAX|WHT|ADVANCE\s+TAX)[\s:.]*([0-9,]{1,8}(?:\.[0-9]{1,2})?)",
    "sales_tax": r"(?:SALES\s+TAX|PRA|GST|FED)[\s:.]*([0-9,]{1,8}(?:\.[0-9]{1,2})?)",
    "arrears": r"(?:ARREARS|PREVIOUS\s+(?:BALANCE|DUES))[\s:.]*([0-9,]{1,10}(?:\.[0-9]{1,2})?)",
}

MONTH_MAP = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
    "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
}

def normalize_date(raw: str) -> str:
    cleaned = raw.strip().upper()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", cleaned):
        return cleaned
    # Match DD-MMM-YYYY or DD-MMM-YY e.g. 15-AUG-2026 or 15-AUG-26
    m = re.match(r"^(\d{1,2})-([A-Z]{3})-(\d{2,4})$", cleaned)
    if m:
        day = m.group(1).zfill(2)
        month = MONTH_MAP.get(m.group(2), "01")
        year = m.group(3)
        if len(year) == 2: year = f"20{year}"
        return f"{year}-{month}-{day}"
    # Match DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", cleaned)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return cleaned

def clean_val(key: str, raw_val: str) -> str:
    compact = re.sub(r"\s+", "", raw_val).replace(",", "")
    if key in ("reading_date", "due_date"):
        return normalize_date(compact)
    return compact

def sniff(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"): return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"): return "image/png"
    if data.startswith(b"\xff\xd8\xff"): return "image/jpeg"
    return None


def extract_fields(text: str) -> dict[str, str]:
    normalized = " ".join(text.upper().split())
    return {key: clean_val(key, match.group(1)) for key, pattern in PATTERNS.items() if (match := re.search(pattern, normalized))}


def candidates_from_tsv(tsv: str, page: int, width: int, height: int) -> dict:
    tokens = []
    position = 0
    for row in csv.DictReader(io.StringIO(tsv), delimiter="\t"):
        word = row.get("text", "").strip().upper()
        if row.get("level") != "5" or not word: continue
        tokens.append({"text": word, "start": position, "end": position + len(word), "left": int(row["left"]), "top": int(row["top"]), "width": int(row["width"]), "height": int(row["height"]), "confidence": float(row["conf"])})
        position += len(word) + 1
    text = " ".join(token["text"] for token in tokens)
    result = {}
    for key, pattern in PATTERNS.items():
        match = re.search(pattern, text)
        if not match: continue
        start, end = match.span(1)
        words = [token for token in tokens if token["start"] < end and token["end"] > start]
        if not words: continue
        left = min(word["left"] for word in words)
        top = min(word["top"] for word in words)
        right = max(word["left"] + word["width"] for word in words)
        bottom = max(word["top"] + word["height"] for word in words)
        confidence = [word["confidence"] for word in words if 0 <= word["confidence"] <= 100]
        result[key] = {"value": clean_val(key, match.group(1)), "page": page, "confidence": round(sum(confidence)/len(confidence), 1) if confidence else None, "box": {"x": left/width, "y": top/height, "width": (right-left)/width, "height": (bottom-top)/height}}
    return result


def process_document(data: bytes, mime: str) -> dict:
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / "source"
        source.write_bytes(data)
        if mime == "application/pdf":
            subprocess.run(["pdftoppm", "-f", "1", "-l", "2", "-scale-to", "1400", "-png", str(source), str(Path(directory)/"page")], check=True, timeout=30, capture_output=True)
            inputs = sorted(Path(directory).glob("page-*.png"))
        else: inputs = [source]
        pages, candidates = [], {}
        for number, original in enumerate(inputs, 1):
            with Image.open(original) as image:
                if image.width * image.height > Image.MAX_IMAGE_PIXELS: raise ValueError("Image dimensions exceed processing limit")
                # Downsample before allocating EXIF/colour copies of a full camera image.
                image.thumbnail((1400, 1400))
                image = ImageOps.exif_transpose(image).convert("RGB")
                width, height = image.size
                preview = Path(directory)/f"preview-{number}.png"
                image.save(preview, "PNG")
            tsv = subprocess.run(["tesseract", str(preview), "stdout", "-l", "eng", "tsv"], check=True, timeout=35, capture_output=True, text=True, env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
            for key, value in candidates_from_tsv(tsv, number, width, height).items(): candidates.setdefault(key, value)
            encoded = base64.b64encode(preview.read_bytes()).decode("ascii")
            if len(encoded) > 12_000_000: raise ValueError("Preview too large")
            pages.append({"page": number, "width": width, "height": height, "mime": "image/png", "imageBase64": encoded})
        if not pages: raise ValueError("No document pages")
        return {"fields": {key: candidate["value"] for key, candidate in candidates.items()}, "candidates": candidates, "pages": pages, "verified_format": False}


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...), x_internal_token: str | None = Header(default=None)) -> dict:
    token = os.environ.get("OCR_INTERNAL_TOKEN")
    if not token or not hmac.compare_digest(x_internal_token or "", token): raise HTTPException(status_code=401, detail="Unauthorized")
    data = await file.read(MAX_BYTES+1)
    if not data or len(data) > MAX_BYTES: raise HTTPException(status_code=413, detail="File size must be 1-8 MB")
    mime = sniff(data)
    if not mime: raise HTTPException(status_code=415, detail="Unsupported file signature")
    if slots.locked(): raise HTTPException(status_code=429, detail="OCR busy; use manual review or retry")
    async with slots:
        try: return await asyncio.to_thread(process_document, data, mime)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="Could not read this document") from exc
