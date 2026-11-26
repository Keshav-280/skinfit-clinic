import { describe, expect, it } from "vitest";
import {
  isAllowedPhotoUrl,
  nameMatch,
  parseReportLink,
  readMedixoraData,
  reportProblem,
} from "@/src/lib/medixora/report";

const photo = (face: string, light: string, name: string) => ({
  FaceType: face,
  LightType: light,
  Pic: `https://bitmoji-sgp.s3.ap-southeast-1.amazonaws.com/${name}.jpg`,
});

describe("Medixora links", () => {
  const good = "https://ff.sdetect.vip/h5app/#/report?report_sn=123456789012345&token=abcdefgh12345678";

  it("accepts a report link", () => {
    expect(parseReportLink(good)?.apiBase).toBe("https://a3ff-api.bitmoji-zm.com");
  });

  it("refuses every other address, even with the same parameters", () => {
    for (const bad of [
      good.replace("https", "http"),
      good.replace("ff.sdetect.vip", "evil.example"),
      good.replace("ff.sdetect.vip", "ff.sdetect.vip.evil.example"),
      good.replace("ff.sdetect.vip", "user@ff.sdetect.vip"),
      "https://ff.sdetect.vip/h5app/#/report",
      "just some text",
    ]) {
      expect(parseReportLink(bad), bad).toBeNull();
    }
  });

  it("only downloads photos from the machine maker's storage", () => {
    expect(isAllowedPhotoUrl(photo("2", "1", "a").Pic)).toBe(true);
    expect(isAllowedPhotoUrl("https://evil.s3.ap-southeast-1.amazonaws.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://169.254.169.254/latest")).toBe(false);
  });
});

describe("Medixora data", () => {
  const report = readMedixoraData({
    Score: "54",
    DeviceCreateTime: "2026-07-03 13:30:23",
    Customer: { Name: "Asha Rao", Sex: "female", Age: "31", Phone: "9999999999", Avatar: "x" },
    CollectImage: [photo("1", "1", "left"), photo("2", "11", "red"), photo("2", "1", "front"), photo("3", "1", "right")],
    ResultDetail: [
      { Name: "Pores", FaceType: "2", Score: "41" },
      { Name: "Acne", FaceType: "1", Score: "82" },
      { Name: "Acne", FaceType: "2", Score: "60" },
      { Name: "Acne", FaceType: "3", Score: "72" },
    ],
  });

  it("takes the white-light front, left and right photos only", () => {
    expect(report.photoUrls.front).toContain("front.jpg");
    expect(report.photoUrls.left).toContain("left.jpg");
    expect(report.photoUrls.right).toContain("right.jpg");
    expect(JSON.stringify(report.photoUrls)).not.toContain("red.jpg");
  });

  it("puts each score under the right view and keeps no phone number", () => {
    expect(report.scores[0]).toEqual({ name: "Acne", front: 60, left: 82, right: 72 });
    expect(report.scores[1]).toEqual({ name: "Pores", front: 41, left: null, right: null });
    expect(JSON.stringify(report)).not.toContain("9999999999");
    expect(reportProblem(report)).toBeNull();
  });

  it("refuses a report without a front photo or scores", () => {
    expect(reportProblem(readMedixoraData({}))).not.toBeNull();
  });

  it("warns when the machine name does not look like the chosen patient", () => {
    expect(nameMatch("Ms. Asha", "Asha Rao")).toBe("match");
    expect(nameMatch("Priya Shah", "Asha Rao")).toBe("different");
    expect(nameMatch("A**a", "Asha Rao")).toBe("unknown");
    expect(nameMatch("", "Asha Rao")).toBe("unknown");
  });
});
