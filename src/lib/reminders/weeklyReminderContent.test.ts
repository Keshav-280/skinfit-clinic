import { describe, expect, it } from "vitest";
import { buildWeeklyReminderEmail } from "@/src/lib/reminders/weeklyReminderContent";

const origin = "https://example.test";
const build = (scan: boolean, checkin: boolean, name = "Priya") =>
  buildWeeklyReminderEmail({ name, origin, pending: { scan, checkin } });

describe("weekly reminder email", () => {
  it("asks for both when both are pending", () => {
    const m = build(true, true);
    expect(m.subject).toBe("Your weekly skin scan and questionnaire are pending");
    expect(m.text).toContain(`${origin}/dashboard/scan`);
    expect(m.text).toContain(`${origin}/dashboard/maintain/checkin`);
  });

  it("mentions only the scan when the questionnaire is done", () => {
    const m = build(true, false);
    expect(m.subject).toBe("Your weekly skin scan is pending");
    expect(m.html).not.toContain("questionnaire");
    expect(m.html).not.toContain("/dashboard/maintain/checkin");
  });

  it("mentions only the questionnaire when the scan is done", () => {
    const m = build(false, true);
    expect(m.subject).toBe("Your weekly questionnaire is pending");
    expect(m.html).not.toContain("/dashboard/scan");
  });

  it("never links to the old Schedules page and always says how to stop", () => {
    const m = build(true, true);
    expect(m.html).not.toContain("/dashboard/schedules");
    expect(m.html).toContain("reply STOP");
    expect(m.text).toContain("reply STOP");
  });

  it("escapes the patient name", () => {
    expect(build(true, true, "<b>x</b>").html).not.toContain("<b>x</b>");
  });
});
