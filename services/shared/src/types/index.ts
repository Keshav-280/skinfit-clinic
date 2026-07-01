/** Shared job + scan types across web, queue, and ML worker. */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type ScanCaptureImageRef = {
  label: string;
  imageUrl: string;
  previewUrl?: string;
};

export type ScanJobPayload = {
  userId: string;
  scanName: string;
  /** Local or future R2 paths keyed by capture step id */
  imagePaths: Record<string, string>;
  faceCaptureImages: ScanCaptureImageRef[];
  primaryImageUrl: string;
  /** Viewfinder metadata for server-side ML crop (identity uses full uploads). */
  captureCropContext?: {
    source: "mobile" | "web";
    viewfinderW?: number;
    viewfinderH?: number;
  };
  /** QR handoff session to mark complete when async scan finishes on desktop. */
  mobileSessionId?: string;
  /** Set by POST /api/scans/submit after face-identity passes — worker skips re-check. */
  identityVerifiedAt?: string;
};

export type ScanJobResult = {
  scanId?: number;
  error?: string;
};

export type StorageObjectKind =
  | "scans"
  | "audio"
  | "masks"
  | "reports"
  | "attachments"
  | "annotator";
