"""
Drop-in replacement for face_analysis_tool/models/backbone.py — loads DINOv2 from disk.

Env:
  DINO_LOCAL_WEIGHTS — path to .pth state_dict (required for offline boot)
  DINO_MODEL_NAME    — default dinov2_vitl14_reg (torch.hub architecture id)
"""

from __future__ import annotations

import os
from pathlib import Path

import torch
import torch.nn as nn


class DINOBackbone(nn.Module):
    """Frozen DINOv2 ViT-L backbone. Offline weights only — no hub weight download."""

    def __init__(self, model_name: str = "dinov2_vitl14_reg"):
        super().__init__()
        weights_path = os.environ.get("DINO_LOCAL_WEIGHTS", "").strip()
        if not weights_path or not Path(weights_path).is_file():
            raise RuntimeError(
                "DINO_LOCAL_WEIGHTS must point to a pre-downloaded .pth file. "
                "See /models/README.md"
            )

        # Hub architecture matches face_analyzer (224×224 → 16×16 patches). Timm's
        # vit_large_patch14_dinov2 defaults to 518×518 and breaks inference.
        self.model = torch.hub.load(
            "facebookresearch/dinov2",
            model_name,
            pretrained=False,
        )
        state = torch.load(weights_path, map_location="cpu", weights_only=True)
        self.model.load_state_dict(state, strict=True)
        self.model.eval()
        for p in self.model.parameters():
            p.requires_grad = False
        self.embed_dim = self.model.embed_dim
        self.patch_size = self.model.patch_size
        self.grid_size = 224 // self.patch_size

    @torch.no_grad()
    def forward(self, x):
        feats = self.model.forward_features(x)
        return feats["x_norm_patchtokens"]
