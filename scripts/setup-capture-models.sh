#!/usr/bin/env bash
# Optional RetinaFace ONNX for server-side capture preview (best framing accuracy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/models/capture"
mkdir -p "$DEST"

echo "RetinaFace ONNX goes in: $DEST/retinaface.onnx"
echo ""
echo "The repo does not ship weights (license/size). Options:"
echo "  1. Export from InsightFace / RetinaFace and place retinaface.onnx in models/capture/"
echo "  2. Use a compatible ONNX from your face_analysis_tool project if you have one"
echo ""
echo "Then in .env.local:"
echo "  FACE_DETECTOR=retinaface"
echo "  NEXT_PUBLIC_FACE_DETECTOR=retinaface"
echo "  pip install -r apps/ml-worker/python/requirements-capture.txt"
echo "  (macOS: python3 -m pip install -r apps/ml-worker/python/requirements-capture.txt)"
echo ""
echo "Check: curl -s http://localhost:3000/api/capture/preview (GET while logged in)"
echo "  -> { enabled: true, retinafaceOnDisk: true }"

if [[ -f "$DEST/retinaface.onnx" ]]; then
  echo ""
  echo "✓ retinaface.onnx already present ($(du -h "$DEST/retinaface.onnx" | cut -f1))"
else
  echo ""
  echo "No retinaface.onnx yet — BlazeFace (browser) is used for framing until you add one."
fi
