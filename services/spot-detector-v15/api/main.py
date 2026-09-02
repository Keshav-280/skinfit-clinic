"""FastAPI wrapper for spot detector v15 — returns annotated image + spot coordinates."""

from __future__ import annotations

import base64
import os

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from api.detector import analyze

API_KEY = os.getenv("API_KEY", "")

app = FastAPI(title="Spot Detector v18", version="1.8")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "spot-detector-v18"}


@app.post("/analyze")
async def analyze_endpoint(
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

    buf = np.frombuffer(data, np.uint8)
    bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    annotated, spots = analyze(bgr)

    _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])
    annotated_b64 = base64.b64encode(jpeg.tobytes()).decode()

    dark_count = sum(1 for s in spots if s.get("kind") == "dark")
    red_count = sum(1 for s in spots if s.get("kind") == "acne")
    scar_count = sum(1 for s in spots if s.get("kind") == "scar")

    return {
        "annotated_image": f"data:image/jpeg;base64,{annotated_b64}",
        "spots": spots,
        "summary": {
            "total": len(spots),
            "dark": dark_count,
            "red": red_count,
            "scar": scar_count,
        },
    }
