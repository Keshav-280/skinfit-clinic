"""
FastAPI acne grading API + web UI at /
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from ultralytics import YOLO

from api.acne_analyzer import analyze_face, decode_image

WEIGHTS_PATH = os.getenv("WEIGHTS_PATH", "best.pt")
API_KEY = os.getenv("API_KEY", "")
STATIC_DIR = Path(__file__).resolve().parent / "static"

model: YOLO | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    path = Path(WEIGHTS_PATH)
    if not path.is_file():
        raise RuntimeError(f"WEIGHTS_PATH not found: {path.resolve()}")
    model = YOLO(str(path))
    yield
    model = None


app = FastAPI(title="AcneDet Grading API", version="1.1", lifespan=lifespan)

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
        raise HTTPException(status_code=404, detail="UI not found — copy api/static/ to server")
    return FileResponse(index)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None, "weights": WEIGHTS_PATH}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image (png/jpeg)")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    try:
        bgr = decode_image(data)
        return analyze_face(model, bgr, include_image=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}") from e
