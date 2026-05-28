"""
Drop-in replacement for face_analysis_tool/models/backbone.py — loads DINOv2 from disk.

Env:
  DINO_LOCAL_WEIGHTS — optional path to .pth state_dict (offline boot)
  DINO_MODEL_NAME    — default dinov2_vitl14_reg (torch.hub architecture id)

If DINO_LOCAL_WEIGHTS is unset or missing, falls back to torch.hub pretrained weights
(first start needs outbound internet — ECS NAT / local dev network).
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
        local_file = bool(weights_path and Path(weights_path).is_file())

        # Hub architecture matches face_analyzer (224×224 → 16×16 patches). Timm's
        # vit_large_patch14_dinov2 defaults to 518×518 and breaks inference.
        if local_file:
            self.model = torch.hub.load(
                "facebookresearch/dinov2",
                model_name,
                pretrained=False,
            )
            state = torch.load(weights_path, map_location="cpu", weights_only=True)
            self.model.load_state_dict(state, strict=True)
        else:
            # AWS ECS: no .pth on EFS yet — download backbone once via NAT (~1 GB).
            self.model = torch.hub.load(
                "facebookresearch/dinov2",
                model_name,
                pretrained=True,
            )
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
