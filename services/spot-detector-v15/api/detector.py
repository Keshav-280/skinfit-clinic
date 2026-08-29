"""Spot detector — v18 zoned blemish / acne / melasma dashed-circle annotations.

kAI scores still come from the face-analysis + acne-detector models.
This service only draws the report overlay image.
"""

from api.spot_v18 import analyze

__all__ = ["analyze"]
