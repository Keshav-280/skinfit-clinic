# Live capture preview models (optional)

Used when `FACE_DETECTOR=retinaface` and/or `FACE_EXPRESSION=classifier` on the **Next.js server** (`POST /api/capture/preview`).

| File | Purpose |
|------|---------|
| `retinaface.onnx` | Face box + 5-point landmarks (head pose) |
| `expression_blink_smile.onnx` | Tiny classifier: `[blink, smile]` sigmoid outputs |

## Trade-offs

- **RetinaFace**: more accurate framing than MediaPipe bbox; heavier CPU (~100–300 ms/frame on server).
- **Classifier**: stabler blink/smile than blendshape thresholds; needs a trained 96×96 face crop model.
- **Mobile**: on-device RetinaFace is not bundled — set `EXPO_PUBLIC_FACE_DETECTOR=retinaface` to call the same API (requires auth + network). MediaPipe is off by default; set `EXPO_PUBLIC_ENABLE_MEDIAPIPE=1` to use on-device landmarks.

## Setup

```bash
pip install -r apps/ml-worker/python/requirements-capture.txt

# Example: download a RetinaFace ONNX (verify license for your deployment)
mkdir -p models/capture
# Place retinaface.onnx and expression_blink_smile.onnx here
```

Env (server):

```bash
FACE_DETECTOR=retinaface          # or mediapipe (default)
FACE_EXPRESSION=classifier        # or blendshapes (default)
FACE_CAPTURE_MODELS_DIR=models/capture
CAPTURE_PREVIEW_PYTHON=python3
```

Env (web client):

```bash
NEXT_PUBLIC_FACE_DETECTOR=retinaface
NEXT_PUBLIC_FACE_EXPRESSION=classifier
```

Env (Expo):

```bash
EXPO_PUBLIC_FACE_DETECTOR=retinaface
EXPO_PUBLIC_FACE_EXPRESSION=classifier
```

Without ONNX files, the preview API returns `detectorAvailable: false` / `expressionAvailable: false` and clients **fall back to MediaPipe** automatically.
