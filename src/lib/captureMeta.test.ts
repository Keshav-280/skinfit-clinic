import { describe, expect, it } from "vitest";
import { parseCaptureMeta, sanitizeCaptureMeta } from "@/src/lib/captureMeta";

describe("captureMeta", () => {
  it("keeps known occlusions and photo checks, drops everything else", () => {
    const m = sanitizeCaptureMeta({
      occlusions: ["beard", "glasses", "hat", "beard"],
      photos: [
        { pose: "centre", lighting: "good", framing: "good" },
        { pose: "left", lighting: "too_dark", framing: "off_center" },
        { pose: "evil", lighting: "good", framing: "good" },
        { pose: "right" },
      ],
    })!;
    expect(m.occlusions).toEqual(["beard", "glasses"]);
    expect(m.photos.map((p) => p.pose)).toEqual(["centre", "left", "right"]);
    expect(m.photos[1]).toEqual({ pose: "left", lighting: "too_dark", framing: "off_center", checked: true });
    expect(m.photos[2]).toEqual({ pose: "right", lighting: null, framing: null, checked: false });
  });

  it("returns undefined for junk or empty input", () => {
    expect(sanitizeCaptureMeta(null)).toBeUndefined();
    expect(sanitizeCaptureMeta("x")).toBeUndefined();
    expect(sanitizeCaptureMeta({ occlusions: [], photos: [] })).toBeUndefined();
    expect(parseCaptureMeta({ get: () => "not json" })).toBeUndefined();
    expect(parseCaptureMeta({ get: () => "x".repeat(5000) })).toBeUndefined();
  });

  it("parses a form field", () => {
    const m = parseCaptureMeta({ get: () => JSON.stringify({ occlusions: ["makeup"], photos: [] }) });
    expect(m).toEqual({ occlusions: ["makeup"], photos: [] });
  });
});
