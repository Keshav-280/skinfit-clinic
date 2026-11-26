import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  cleanPhone,
  emptyIntake,
  intakeAlerts,
  intakeErrors,
  profileFromIntake,
  sanitizeIntake,
} from "@/src/lib/intake/form";

const now = new Date(2026, 10, 26);
const filled = (patch: Record<string, unknown> = {}) =>
  sanitizeIntake({
    ...emptyIntake(),
    name: "Test Person",
    dateOfBirth: "1995-11-27",
    gender: "Female",
    phone: "98765 43210",
    medicalConditions: ["None"],
    pregnancy: ["None of the Above"],
    photoConsent: "Yes",
    declarationAccepted: true,
    signatureName: "Test Person",
    ...patch,
  });

describe("clinic intake form", () => {
  it("accepts the minimum required answers", () => {
    expect(intakeErrors(filled(), now)).toEqual([]);
  });

  it("requires medical history, photography answer, declaration and signature", () => {
    const fields = intakeErrors(
      filled({ medicalConditions: [], photoConsent: "", declarationAccepted: false, signatureName: "" }),
      now
    ).map((e) => e.field);
    expect(fields).toEqual(["medicalConditions", "photoConsent", "declarationAccepted", "signatureName"]);
  });

  it("asks the pregnancy question only of female patients", () => {
    expect(intakeErrors(filled({ pregnancy: [] }), now).map((e) => e.field)).toEqual(["pregnancy"]);
    expect(intakeErrors(filled({ gender: "Male", pregnancy: [] }), now)).toEqual([]);
  });

  it("works out age from the date of birth and rejects impossible dates", () => {
    expect(ageFromDob("1995-11-27", now)).toBe(30);
    expect(ageFromDob("1995-11-26", now)).toBe(31);
    expect(ageFromDob("1995-02-30", now)).toBeNull();
    expect(ageFromDob("2030-01-01", now)).toBeNull();
  });

  it("stores Indian numbers as ten digits", () => {
    expect(cleanPhone("+91", "+91 98765-43210")).toBe("9876543210");
    expect(cleanPhone("+91", "09876543210")).toBe("9876543210");
    expect(cleanPhone("+91", "9187967633")).toBe("9187967633");
    expect(cleanPhone("+91", "12345")).toBeNull();
  });

  it("drops unknown options and never lets None hide a real condition", () => {
    const a = filled({ medicalConditions: ["None", "Diabetes", "Made up"], concerns: ["Hacking"] });
    expect(a.medicalConditions).toEqual(["Diabetes"]);
    expect(a.concerns).toEqual([]);
  });

  it("flags safety answers for the clinician", () => {
    const alerts = intakeAlerts(
      filled({ medicalConditions: ["Keloid Tendency"], pregnancy: ["Pregnant"], drugAllergies: "Penicillin", photoConsent: "No" })
    ).join(" | ");
    expect(alerts).toContain("Keloid Tendency");
    expect(alerts).toContain("Pregnant");
    expect(alerts).toContain("Penicillin");
    expect(alerts).toContain("Did NOT agree");
  });

  it("always gives the app a main concern, so no questionnaire is asked again", () => {
    expect(profileFromIntake(filled(), now).primaryConcern).toBe("general");
    expect(profileFromIntake(filled({ concerns: ["Melasma", "Acne"] }), now).concerns).toEqual(["acne", "pigmentation"]);
  });
});
