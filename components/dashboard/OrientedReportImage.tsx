"use client";

/**
 * @deprecated Model mask JPEGs are upright; use a plain `<img>` instead.
 * Kept for backwards compatibility — no auto-rotation.
 */
export function OrientedReportImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
