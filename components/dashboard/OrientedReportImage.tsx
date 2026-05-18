"use client";

import { useState } from "react";

/** Correct legacy mask JPEGs saved without EXIF orientation (wider than tall). */
export function OrientedReportImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [rotate90, setRotate90] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={
        rotate90
          ? { transform: "rotate(90deg) scale(1.42)", transformOrigin: "center" }
          : undefined
      }
      onLoad={(e) => {
        const img = e.currentTarget;
        setRotate90(img.naturalWidth > img.naturalHeight * 1.08);
      }}
    />
  );
}
