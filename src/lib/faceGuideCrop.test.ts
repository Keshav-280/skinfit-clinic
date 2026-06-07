import assert from "node:assert/strict";

import {
  getFrontGuideCropRectViewBox,
  getVisibleVideoRect,
  viewBoxRectToViewfinderNorm,
  viewfinderNormRectToVideoSource,
  viewfinderNormRectToVideoSourceWithZoom,
} from "./faceGuideCrop";

function approx(a: number, b: number, eps = 1e-6) {
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);
}

function rectEq(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  eps = 1e-6
) {
  approx(a.x, b.x, eps);
  approx(a.y, b.y, eps);
  approx(a.w, b.w, eps);
  approx(a.h, b.h, eps);
}

// 16:9 sensor in a 3:4 viewfinder (240×320)
const videoW = 1920;
const videoH = 1080;
const viewfinderW = 240;
const viewfinderH = 320;

const visibleZoom1 = getVisibleVideoRect(
  videoW,
  videoH,
  viewfinderW,
  viewfinderH,
  1
);
assert.ok(visibleZoom1.sw < videoW, "object-cover should crop width on landscape video");
assert.ok(visibleZoom1.sh === videoH, "landscape video fills viewfinder height");
approx(visibleZoom1.sx, (videoW - visibleZoom1.sw) / 2);
approx(visibleZoom1.sy, 0);

const fullViewfinder = viewfinderNormRectToVideoSourceWithZoom(
  { x: 0, y: 0, w: 1, h: 1 },
  videoW,
  videoH,
  viewfinderW,
  viewfinderH,
  1
);
rectEq(fullViewfinder, {
  x: visibleZoom1.sx,
  y: visibleZoom1.sy,
  w: visibleZoom1.sw,
  h: visibleZoom1.sh,
});

const legacy = viewfinderNormRectToVideoSource(
  { x: 0, y: 0, w: 1, h: 1 },
  videoW,
  videoH,
  viewfinderW,
  viewfinderH
);
rectEq(fullViewfinder, legacy);

const visibleZoom2 = getVisibleVideoRect(
  videoW,
  videoH,
  viewfinderW,
  viewfinderH,
  2
);
approx(visibleZoom2.sw, visibleZoom1.sw / 2);
approx(visibleZoom2.sh, visibleZoom1.sh / 2);
approx(visibleZoom2.sx, (videoW - visibleZoom2.sw) / 2);
approx(visibleZoom2.sy, (videoH - visibleZoom2.sh) / 2);

const centerNorm = { x: 0.4, y: 0.35, w: 0.2, h: 0.3 };
const mapped = viewfinderNormRectToVideoSourceWithZoom(
  centerNorm,
  videoW,
  videoH,
  viewfinderW,
  viewfinderH,
  2
);
rectEq(mapped, {
  x: visibleZoom2.sx + centerNorm.x * visibleZoom2.sw,
  y: visibleZoom2.sy + centerNorm.y * visibleZoom2.sh,
  w: centerNorm.w * visibleZoom2.sw,
  h: centerNorm.h * visibleZoom2.sh,
});

const viewBoxRect = getFrontGuideCropRectViewBox();
const vfNorm = viewBoxRectToViewfinderNorm(viewBoxRect);
const guideCrop = viewfinderNormRectToVideoSourceWithZoom(
  vfNorm,
  videoW,
  videoH,
  viewfinderW,
  viewfinderH,
  1.5
);
const aspect = guideCrop.w / guideCrop.h;
approx(aspect, 3 / 4, 0.01);

console.log("faceGuideCrop.test.ts: all assertions passed");
