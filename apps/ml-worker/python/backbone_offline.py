"""
Drop-in replacement for face_analysis_tool/models/backbone.py — loads DINOv2 from disk.

Env:
  DINO_LOCAL_WEIGHTS — path to .pth state_dict (required for offline boot)
  DINO_MODEL_NAME    — default dinov2_vitl14_reg (architecture id for hub builder)
"""

from __future__ import annotations

import os
from pathlib import Path

import torch
import torch.nn as nn


class DINOBackbone(nn.Module):
    """Frozen DINOv2 ViT-L backbone. Offline weights only — no torch.hub at runtime."""

    def __init__(self, model_name: str = "dinov2_vitl14_reg"):
        super().__init__()
        weights_path = os.environ.get("DINO_LOCAL_WEIGHTS", "").strip()
        if not weights_path or not Path(weights_path).is_file():
            raise RuntimeError(
                "DINO_LOCAL_WEIGHTS must point to a pre-downloaded .pth file. "
                "See /models/README.md"
            )
        # Build architecture once (can use hub in build image only — not at runtime in prod)
        if os.environ.get("ALLOW_HUB_AT_BUILD") == "1":
            self.model = torch.hub.load("facebookresearch/dinov2", model_name)
        else:
            import timm

            self.model = timm.create_model(
                "vit_large_patch14_dinov2.lvd142m",
                pretrained=False,
                num_classes=0,
            )
        state = torch.load(weights_path, map_location="cpu", weights_only=True)
        self.model.load_state_dict(state, strict=False)
        self.model.eval()
        for p in self.model.parameters():
            p.requires_grad = False
        self.embed_dim = getattr(self.model, "embed_dim", 1024)
        self.patch_size = getattr(self.model, "patch_size", 14)
        self.grid_size = 224 // self.patch_size

    @torch.no_grad()
    def forward(self, x):
        feats = self.model.forward_features(x)
        if isinstance(feats, dict):
            return feats["x_norm_patchtokens"]
        return feats
