from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile

app = FastAPI(docs_url=None, redoc_url=None)
MAX_BYTES = 8 * 1024 * 1024


def sniff(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def extract_fields(text: str) -> dict[str, str]:
    """Conservative hints only. A user must confirm every extracted value."""
    patterns = {
        "reference_number": r"(?:REFERENCE\s*(?:NO|NUMBER|#)?)[\s:]*([0-9]{14})",
        "previous_reading": r"(?:PREVIOUS\s+READING|PREV\s+READING)[\s:]*([0-9]+(?:\.[0-9]+)?)",
        "current_reading": r"(?:CURRENT\s+READING|PRESENT\s+READING)[\s:]*([0-9]+(?:\.[0-9]+)?)",
        "billed_units": r"(?:UNITS\s+CONSUMED|CONSUMED\s+UNITS|BILLED\s+UNITS)[\s:]*([0-9]+(?:\.[0-9]+)?)",
        "total_amount": r"(?:PAYABLE\s+WITHIN\s+DUE\s+DATE|AMOUNT\s+PAYABLE|TOTAL\s+AMOUNT)[\s:]*([0-9,]+(?:\.[0-9]{1,2})?)",
    }
    normalized = " ".join(text.upper().split())
    return {key: match.group(1).replace(",", "") for key, pattern in patterns.items() if (match := re.search(pattern, normalized))}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...), x_internal_token: str | None = Header(default=None)) -> dict:
    token = os.environ.get("OCR_INTERNAL_TOKEN")
    if not token or x_internal_token != token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    data = await file.read(MAX_BYTES + 1)
    if len(data) == 0 or len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File size must be 1-8 MB")
    mime = sniff(data)
    if not mime:
        raise HTTPException(status_code=415, detail="Unsupported file signature")

    try:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / ("source.pdf" if mime == "application/pdf" else "source.png" if mime == "image/png" else "source.jpg")
            source.write_bytes(data)
            if mime == "application/pdf":
                prefix = Path(directory) / "page"
                subprocess.run(["pdftoppm", "-f", "1", "-l", "2", "-scale-to", "2200", "-png", str(source), str(prefix)], check=True, timeout=25, capture_output=True)
                pages = sorted(Path(directory).glob("page-*.png"))
            else:
                pages = [source]
            pieces = []
            for page in pages:
                result = subprocess.run(["tesseract", str(page), "stdout", "-l", "eng"], check=True, timeout=20, capture_output=True, text=True)
                pieces.append(result.stdout)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=422, detail="Could not read this document")
    text = "\n".join(pieces)
    return {"fields": extract_fields(text), "status": "extracted", "verified_format": False}
