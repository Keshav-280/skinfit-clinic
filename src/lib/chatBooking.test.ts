import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/src/db", () => ({ db: {} }));
vi.mock("@/src/db/schema", () => ({}));
vi.mock("@/src/lib/chatLive", () => ({ notifyChatThreadUpdated: vi.fn() }));
vi.mock("@/src/lib/appointmentRequests", () => ({
  createAppointmentRequest: vi.fn(async () => {
    throw new Error("must not be called without a clear yes");
  }),
}));
vi.mock("@/src/lib/doctorPatientCare", () => ({
  getAssignedDoctorIdForPatient: vi.fn(),
  listRegisteredClinicDoctors: vi.fn(),
}));
vi.mock("@/src/lib/ensurePatientPhoneForBooking", () => ({ ensurePatientPhoneForBooking: vi.fn() }));
vi.mock("@/src/lib/doctorDisplayName", () => ({ patientDoctorLabel: (n: string) => n }));

import { isClearConfirmation, KAI_BOOKING_TOOLS, runKaiBookingTool } from "@/src/lib/chatBooking";

describe("isClearConfirmation", () => {
  it("accepts a plain yes in a few ways", () => {
    for (const m of ["yes", "Yes please", "yeah sure", "ok go ahead", "Confirm", "haan kar do book it", "sure, book it"]) {
      expect(isClearConfirmation(m)).toBe(true);
    }
  });

  it("rejects questions, refusals and anything that is not a clear yes", () => {
    for (const m of [
      "",
      "What times do you have?",
      "Can you help me schedule a meeting?",
      "no, a different day",
      "yes but can we change the time",
      "not yet",
      "tomorrow morning",
      "I want to book an appointment for next week because my acne is getting worse and I am worried",
    ]) {
      expect(isClearConfirmation(m)).toBe(false);
    }
  });
});

describe("request_appointment guard", () => {
  it("does not send a request unless the patient's latest message is a clear yes", async () => {
    const unsure = { userId: "u1", latestUserMessage: "the Tuesday one looks good, what time does it end?" };
    expect((await runKaiBookingTool("request_clinic_visit", JSON.stringify({ slot_id: "abc", issue: "acne" }), unsure)).error).toBe("NOT_CONFIRMED");
    // same guard for the fallback message to the clinic team
    const fallback = JSON.stringify({ preferred_day: "Saturday", preferred_time: "morning", issue: "acne" });
    expect((await runKaiBookingTool("send_visit_request_to_clinic_team", fallback, unsure)).error).toBe("NOT_CONFIRMED");
  });

  it("rejects malformed tool arguments without throwing", async () => {
    expect(
      (await runKaiBookingTool("request_clinic_visit", "{not json", { userId: "u1", latestUserMessage: "yes" })).error
    ).toBe("BAD_ARGUMENTS");
    expect((await runKaiBookingTool("nope", "{}", { userId: "u1", latestUserMessage: "yes" })).error).toBe(
      "UNKNOWN_TOOL"
    );
  });

  it("exposes the three visit tools, none of which name a doctor", () => {
    expect(KAI_BOOKING_TOOLS.map((t) => t.function.name)).toEqual([
      "get_open_visit_times",
      "request_clinic_visit",
      "send_visit_request_to_clinic_team",
    ]);
    expect(JSON.stringify(KAI_BOOKING_TOOLS).toLowerCase()).not.toContain("doctor_id");
  });
});
