/** Serve URL for annotator objects stored at `annotator/<uuid>.<ext>`. */
export function annotatorServeUrl(storagePath: string): string {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `/api/annotator/files/${encoded}`;
}

export function resolveAnnotatorImageSrc(
  fileUrl: string | null | undefined,
  dataUri: string | null | undefined
): string {
  if (fileUrl?.trim()) return annotatorServeUrl(fileUrl.trim());
  return dataUri?.trim() ?? "";
}
