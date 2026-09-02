import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E1B31",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#FAF8F5",
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size }
  );
}
