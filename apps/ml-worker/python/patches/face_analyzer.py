"""Complete face analysis model: frozen DINOv2 backbone + task heads.

Skinfit patch: sagging contour from ISGD chubby/double_chin (Indian labels), not CelebA.
App layer composites contour + under-eye + wrinkles into the displayed sagging score.
"""

import torch
import torch.nn as nn

from .backbone import DINOBackbone
from .heads import AcneDetHead, ClassificationHead, WrinkleSegHead


class FaceAnalyzer(nn.Module):
    FEATURE_NAMES = [
        "active_acne", "acne_scars", "skin_quality", "pigmentation",
        "wrinkles", "sagging_volume", "under_eye", "hair_health",
    ]

    def __init__(self, backbone_name="dinov2_vitl14_reg", n_isgd_labels=7,
                 input_size=224):
        super().__init__()
        self.backbone = DINOBackbone(backbone_name)
        D = self.backbone.embed_dim
        G = self.backbone.grid_size

        self.cls_head = ClassificationHead(D, n_isgd_labels)
        self.wrinkle_head = WrinkleSegHead(D, G, input_size)
        self.acne_head = AcneDetHead(D, G)
        self.pigmentation_head = ClassificationHead(D, 1)
        self.acne_scars_head = ClassificationHead(D, 1)
        self.cls_head_celeba = ClassificationHead(D, n_isgd_labels)
        self._has_celeba_cls = False
        self._celeba_zero_priors = False
        self._wrinkle_weights_source = "bundle"

    def extract(self, x):
        return self.backbone(x)

    def forward_cls(self, p):
        return self.cls_head(p)

    def forward_wrinkle(self, p):
        return self.wrinkle_head(p)

    def forward_acne(self, p):
        return self.acne_head(p)

    def forward_pigmentation(self, p):
        return self.pigmentation_head(p)

    def forward_acne_scars(self, p):
        return self.acne_scars_head(p)

    @torch.no_grad()
    def predict_all(self, x):
        self.eval()
        p = self.extract(x)

        cls_sev = self.cls_head.severity(p)
        cls_celeba = (
            self.cls_head_celeba.severity(p) if self._has_celeba_cls else cls_sev
        )
        wrinkle_mask, _ = self.wrinkle_head(p)
        wrinkle_sev_seg = self.wrinkle_head.severity(p)
        acne_obj, acne_sev = self.acne_head(p)
        pig_sev = self.pigmentation_head.severity(p).squeeze(-1)
        scar_sev = self.acne_scars_head.severity(p).squeeze(-1)

        skin_q = torch.clamp(
            (cls_celeba[:, 3] + 6.0 - cls_celeba[:, 4]) / 2.0, 1.0, 5.0
        )
        # ISGD chubby + double_chin — better contour proxy for Indian faces than CelebA.
        sagging = torch.clamp((cls_sev[:, 5] + cls_sev[:, 6]) / 2.0, 1.0, 5.0)

        if self._celeba_zero_priors and self._has_celeba_cls:
            under_eye_src = cls_celeba[:, 0]
            wrinkle_cls = cls_celeba[:, 1]
            hair_health_src = cls_celeba[:, 2]
        else:
            under_eye_src = cls_sev[:, 0]
            wrinkle_cls = cls_sev[:, 1]
            hair_health_src = cls_sev[:, 2]

        return {
            "active_acne": acne_sev,
            "acne_scars": scar_sev,
            "skin_quality": skin_q,
            "pigmentation": pig_sev,
            "wrinkles": (wrinkle_cls + wrinkle_sev_seg) / 2,
            "wrinkle_cls_severity": wrinkle_cls,
            "wrinkle_seg_severity": wrinkle_sev_seg,
            "sagging_volume": sagging,
            "under_eye": under_eye_src,
            "hair_health": hair_health_src,
            "wrinkle_mask": torch.sigmoid(wrinkle_mask),
            "acne_objectness": torch.sigmoid(acne_obj),
            "active_acne_global": acne_sev,
        }
