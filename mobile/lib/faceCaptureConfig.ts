export type {
  FaceDetectorBackend,
  FaceExpressionBackend,
} from "../../src/lib/faceCaptureConfig";
export {
  getMobileFaceCaptureConfig,
  usesServerFacePreview,
  shouldTryServerPreviewOnClient,
  wantsOptionalServerPreview,
  needsMediapipeOnClient,
  isMediapipeEnabled,
} from "../../src/lib/faceCaptureConfig";
