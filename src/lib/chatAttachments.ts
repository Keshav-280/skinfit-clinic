/** Patient/doctor chat attachment helpers (data URIs stored on chat_messages.attachment_url). */

export const MAX_CHAT_ATTACHMENT_URI_LEN = 3_200_000;
export const MAX_CHAT_PENDING_ATTACHMENTS = 6;
const PER_FILE_TARGET_CHARS = 520_000;
const MULTI_PREFIX = "skinfit-chat-multi:";

export type ChatPendingAttachment = {
  id: string;
  fileName: string;
  dataUri: string;
};

function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FILE_READ_FAILED"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

const IMAGE_EXT =
  /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif)$/i;
const AUDIO_EXT =
  /\.(mp3|wav|m4a|aac|ogg|webm|mp4|caf)$/i;

/** Some browsers report empty or generic MIME for camera/gallery picks. */
export function resolveChatAttachmentMime(file: File): string {
  const raw = file.type.trim().toLowerCase();
  if (raw && raw !== "application/octet-stream") return raw;
  const name = file.name.toLowerCase();
  if (IMAGE_EXT.test(name)) {
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
    if (name.endsWith(".avif")) return "image/avif";
    return "image/jpeg";
  }
  if (AUDIO_EXT.test(name)) {
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".webm")) return "audio/webm";
    if (name.endsWith(".m4a") || name.endsWith(".mp4")) return "audio/mp4";
    if (name.endsWith(".ogg")) return "audio/ogg";
    return "audio/mpeg";
  }
  return raw;
}

export function isChatImageFile(file: File): boolean {
  const mime = resolveChatAttachmentMime(file);
  return mime.startsWith("image/") || IMAGE_EXT.test(file.name);
}

export function isChatAudioFile(file: File): boolean {
  const mime = resolveChatAttachmentMime(file);
  return mime.startsWith("audio/") || AUDIO_EXT.test(file.name);
}

function loadImageForCanvas(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = dataUri;
  });
}

/** Compress large images down toward `limitChars` (JPEG). */
export async function compressChatImageDataUri(
  file: File,
  limitChars = PER_FILE_TARGET_CHARS
): Promise<string> {
  const original = await fileToDataUri(file);
  if (original.length <= limitChars) return original;

  try {
    const img = await loadImageForCanvas(original);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;

    const scales = [1, 0.85, 0.7, 0.55, 0.45, 0.35];
    const qualities = [0.88, 0.78, 0.68, 0.58, 0.48, 0.38];

    let best = original;
    for (const scale of scales) {
      const w = Math.max(280, Math.round(img.width * scale));
      const h = Math.max(280, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      for (const q of qualities) {
        const candidate = canvas.toDataURL("image/jpeg", q);
        if (candidate.length < best.length) best = candidate;
        if (candidate.length <= limitChars) return candidate;
      }
    }
    return best;
  } catch {
    // HEIC / unsupported decode - keep original if small enough, else fail upstream.
    return original;
  }
}

export async function prepareChatAttachmentFromFile(
  file: File
): Promise<ChatPendingAttachment> {
  if (!isChatImageFile(file) && !isChatAudioFile(file)) {
    throw new Error("ONLY_IMAGE_OR_AUDIO");
  }

  let dataUri: string;
  if (isChatImageFile(file)) {
    dataUri = await compressChatImageDataUri(file);
    if (dataUri.length > PER_FILE_TARGET_CHARS) {
      throw new Error("IMAGE_TOO_LARGE");
    }
  } else {
    dataUri = await fileToDataUri(file);
    if (dataUri.length > PER_FILE_TARGET_CHARS) {
      throw new Error("AUDIO_TOO_LARGE");
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name.trim() || "attachment",
    dataUri,
  };
}

export async function prepareChatAttachmentFromBlob(
  blob: Blob,
  fileName: string
): Promise<ChatPendingAttachment> {
  let finalBlob = blob;
  if (blob.type.includes("webm")) {
    try {
      finalBlob = await transcodeRecordingToWav(blob);
    } catch {
      /* keep original */
    }
  }
  const file = new File([finalBlob], fileName, {
    type: finalBlob.type || "application/octet-stream",
  });
  return prepareChatAttachmentFromFile(file);
}

async function transcodeRecordingToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const arrayBuf = await blob.arrayBuffer();
  const audio = await ctx.decodeAudioData(arrayBuf);
  const numCh = audio.numberOfChannels;
  const rate = audio.sampleRate;
  const length = audio.length;
  const buffer = new ArrayBuffer(44 + length * numCh * 2);
  const view = new DataView(buffer);

  function writeStr(off: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * numCh * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * numCh * 2, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(audio.getChannelData(ch));
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch]![i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  await ctx.close();
  return new Blob([buffer], { type: "audio/wav" });
}

export function parseChatAttachments(
  stored: string | null | undefined
): string[] {
  if (!stored) return [];
  if (stored.startsWith(MULTI_PREFIX)) {
    try {
      const parsed = JSON.parse(stored.slice(MULTI_PREFIX.length)) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0
      );
    } catch {
      return [];
    }
  }
  return [stored];
}

export function serializeChatAttachments(uris: string[]): string | null {
  const clean = uris.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0]!;
  return `${MULTI_PREFIX}${JSON.stringify(clean)}`;
}

function normalizeSingleAttachment(raw: unknown): string | null | "INVALID" {
  if (raw == null) return null;
  if (typeof raw !== "string") return "INVALID";
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_CHAT_ATTACHMENT_URI_LEN) return "INVALID";
  if (!t.startsWith("data:image/") && !t.startsWith("data:audio/")) {
    return "INVALID";
  }
  return t;
}

/** Validate client payload and produce DB value (single or bundled). */
export function normalizeChatAttachmentsInput(body: {
  attachmentUrl?: unknown;
  attachmentUrls?: unknown;
}): string | null | "INVALID" {
  const collected: string[] = [];

  if (Array.isArray(body.attachmentUrls)) {
    if (body.attachmentUrls.length > MAX_CHAT_PENDING_ATTACHMENTS) {
      return "INVALID";
    }
    for (const item of body.attachmentUrls) {
      const parsed = normalizeSingleAttachment(item);
      if (parsed === "INVALID") return "INVALID";
      if (parsed) collected.push(parsed);
    }
  }

  if (collected.length === 0) {
    const single = normalizeSingleAttachment(body.attachmentUrl);
    if (single === "INVALID") return "INVALID";
    if (single) collected.push(single);
  }

  const stored = serializeChatAttachments(collected);
  if (stored && stored.length > MAX_CHAT_ATTACHMENT_URI_LEN) return "INVALID";
  return stored;
}

export function chatAttachmentPreviewText(stored: string | null | undefined): string {
  const urls = parseChatAttachments(stored);
  if (urls.length === 0) return "";
  if (urls.length === 1) {
    return urls[0]!.startsWith("data:audio/") ? "🎤 Voice note" : "🖼️ Image";
  }
  return `📎 ${urls.length} attachments`;
}

export function dataUriKind(
  uri: string | null | undefined
): "image" | "audio" | "other" | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  return "other";
}
