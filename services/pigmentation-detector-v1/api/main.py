"""FastAPI dark-spot grid detector — standalone tool (does not touch face scan pipeline)."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from api.dark_spot_analyzer import analyze_dark_spots, decode_image

API_KEY = os.getenv("API_KEY", "")
STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Dark Spot Grid Detector", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def web_ui():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="UI not found")
    return FileResponse(index)


@app.get("/health")
def health():
    return {"status": "ok", "service": "pigmentation-detector-v1"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image (png/jpeg)")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    try:
        bgr = decode_image(data)
        return analyze_dark_spots(bgr, include_image=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}") from e
