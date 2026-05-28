# Model weights (offline — no runtime `torch.hub` downloads)

Place files here before starting `ml-inference` or the ML worker:

```
models/
  checkpoints/
    face_analyzer_v13.pt      # from face_analysis_tool
    best_wrinkle.pt           # optional
  dinov2_vitl14_reg.pth       # pre-downloaded DINOv2 backbone
```

## One-time download (run on a machine with internet)

```bash
# DINOv2 ViT-L/14 — save next to checkpoints
python -c "
import torch
m = torch.hub.load('facebookresearch/dinov2', 'dinov2_vitl14_reg')
torch.save(m.state_dict(), 'models/dinov2_vitl14_reg.pth')
"

# Copy analyzer checkpoint from face_analysis_tool
cp ../Desktop/face_analysis_tool/checkpoints/face_analyzer_v13.pt models/checkpoints/
```

Set `DINO_LOCAL_WEIGHTS=/models/dinov2_vitl14_reg.pth` in Docker (see `docker/docker-compose.yml`).

## Live capture preview (optional)

See [`capture/README.md`](capture/README.md) for RetinaFace + blink/smile classifier ONNX used during scan guidance (`FACE_DETECTOR` / `FACE_EXPRESSION`).

Patch `face_analysis_tool/models/backbone.py` to load from `DINO_LOCAL_WEIGHTS` instead of `torch.hub.load` — reference implementation in `apps/ml-worker/python/backbone_offline.py`.
