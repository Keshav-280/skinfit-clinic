import { NextResponse } from "next/server";
import { decodeDataUrlImage } from "@/src/lib/dataUrlImage";
import {
  fetchPublicImageToBuffer,
  isUrlSafeForServerSideImageFetch,
} from "@/src/lib/fetchPublicImageForPreview";
import {
  bufferToPreviewJpegBuffer,
  listThumbnailJpegOpts,
  type PreviewJpegOpts,
} from "@/src/lib/scanImagePreview";

export type FaceCaptureStored = {
  label: string;
  dataUri: string;
  previewDataUri?: string;
};

export async function scanImageNextResponse(input: {
  imageUrl: string | null | undefined;
  faceCaptureImages: FaceCaptureStored[] | null | undefined;
  index: number;
  preview: boolean;
  /** List/card cover: smaller JPEG than default preview (requires `preview`). */
  thumbnail?: boolean;
}): Promise<NextResponse> {
  const { imageUrl, faceCaptureImages: multi, index, preview, thumbnail } = input;
  const jpegOpts: PreviewJpegOpts | undefined =
    preview && thumbnail ? listThumbnailJpegOpts() : undefined;

  const maxIdx = multi && multi.length > 0 ? multi.length - 1 : 0;
  if (!Number.isFinite(index) || index < 0 || index > maxIdx) {
    return NextResponse.json({ error: "INVALID_INDEX" }, { status: 400 });
  }

  let fullUrl = "";
  let storedPreview = "";

  if (multi && multi.length > index && multi[index]?.dataUri) {
    fullUrl = multi[index]!.dataUri.trim();
    storedPreview = multi[index]!.previewDataUri?.trim() ?? "";
  } else if (index === 0) {
    fullUrl = imageUrl?.trim() ?? "";
  } else {
    return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  if (!fullUrl || fullUrl === "pending_upload") {
    return NextResponse.json({ error: "IMAGE_NOT_READY" }, { status: 404 });
  }

  const sendBytes = (mime: string, buf: Buffer) =>
    new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });

  if (preview) {
    if (storedPreview.startsWith("data:")) {
      const decoded = decodeDataUrlImage(storedPreview);
      if (!decoded || decoded.buffer.length === 0) {
        return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 500 });
      }
      if (jpegOpts) {
        try {
          const out = await bufferToPreviewJpegBuffer(decoded.buffer, jpegOpts);
          return sendBytes("image/jpeg", out);
        } catch {
          /* fall through to stored bytes */
        }
      }
      return sendBytes(decoded.mime, decoded.buffer);
    }

    if (fullUrl.startsWith("data:")) {
      const decoded = decodeDataUrlImage(fullUrl);
      if (!decoded || decoded.buffer.length === 0) {
        return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 500 });
      }
      try {
        const out = await bufferToPreviewJpegBuffer(decoded.buffer, jpegOpts);
        return sendBytes("image/jpeg", out);
      } catch {
        return sendBytes(decoded.mime, decoded.buffer);
      }
    }

    if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
      if (isUrlSafeForServerSideImageFetch(fullUrl)) {
        const remote = await fetchPublicImageToBuffer(fullUrl);
        if (remote && remote.length > 0) {
          try {
            const out = await bufferToPreviewJpegBuffer(remote, jpegOpts);
            return sendBytes("image/jpeg", out);
          } catch {
            /* fall through to redirect */
          }
        }
      }
      return NextResponse.redirect(fullUrl);
    }

    return NextResponse.json({ error: "UNSUPPORTED_IMAGE_URL" }, { status: 500 });
  }

  if (fullUrl.startsWith("data:")) {
    const decoded = decodeDataUrlImage(fullUrl);
    if (!decoded || decoded.buffer.length === 0) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 500 });
    }
    return sendBytes(decoded.mime, decoded.buffer);
  }

  if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
    return NextResponse.redirect(fullUrl);
  }

  return NextResponse.json({ error: "UNSUPPORTED_IMAGE_URL" }, { status: 500 });
}
