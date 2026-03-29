import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, count, eq, isNull } from "drizzle-orm";
import { DEMO_LOGIN_EMAIL } from "../lib/auth/demo-login";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
} from "../lib/date-only";
import {
  DEFAULT_PRIORITY_REMINDERS,
  getDefaultScheduleEvents,
} from "../lib/defaultSchedulesData";
import { db } from "./index";
import {
  users,
  skinScans,
  appointments,
  dailyLogs,
  visitNotes,
  priorityReminders,
  scheduleEvents,
} from "./schema";

const DEMO_PATIENT_EMAIL = DEMO_LOGIN_EMAIL;
const DEMO_PATIENT_PASSWORD = "SkinFitDemo2024!";
const DOCTOR_EMAIL = "doctor@skinfit.com";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    const patientHash = await bcrypt.hash(DEMO_PATIENT_PASSWORD, 10);
    const doctorHash = await bcrypt.hash("DocDemo2024!", 10);

    // 1. Ensure demo users exist (safe to run multiple times)
    await db
      .insert(users)
      .values({
        name: "Demo Patient",
        email: DEMO_PATIENT_EMAIL,
        passwordHash: patientHash,
        role: "patient",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash: patientHash,
          name: "Demo Patient",
          role: "patient",
        },
      });

    await db
      .insert(users)
      .values({
        name: "Dr. Sarah Chen",
        email: DOCTOR_EMAIL,
        passwordHash: doctorHash,
        role: "doctor",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash: doctorHash,
          name: "Dr. Sarah Chen",
          role: "doctor",
        },
      });

    const [patient] = await db
      .select()
      .from(users)
      .where(eq(users.email, DEMO_PATIENT_EMAIL))
      .limit(1);
    const [doctor] = await db
      .select()
      .from(users)
      .where(eq(users.email, DOCTOR_EMAIL))
      .limit(1);

    if (!patient || !doctor) {
      throw new Error("Could not load demo users after upsert.");
    }

    console.log("✓ Demo patient:", patient.email);
    console.log("✓ Demo doctor:", doctor.email);

    // 2. Sample skin_scans (up to 3 rows, staggered dates; higher metric = healthier)
    const [{ n: skinScanCount }] = await db
      .select({ n: count() })
      .from(skinScans)
      .where(eq(skinScans.userId, patient.id));

    const have = Number(skinScanCount);
    const templates = [
      {
        skinScore: 82,
        daysAgo: 7,
        analysisResults: {
          acne: 90,
          wrinkles: 84,
          texture: 43,
          pigmentation: 65,
          hydration: 65,
          eczema: 55,
        },
      },
      {
        skinScore: 74,
        daysAgo: 48,
        analysisResults: {
          acne: 76,
          wrinkles: 72,
          texture: 52,
          pigmentation: 62,
          hydration: 58,
          eczema: 50,
        },
      },
      {
        skinScore: 68,
        daysAgo: 95,
        analysisResults: {
          acne: 68,
          wrinkles: 65,
          texture: 38,
          pigmentation: 55,
          hydration: 52,
          eczema: 45,
        },
      },
    ];

    for (let i = have; i < 3; i++) {
      const t = templates[i];
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - t.daysAgo);
      await db.insert(skinScans).values({
        userId: patient.id,
        originalImageUrl: "https://example.com/scans/demo-original.jpg",
        annotatedImageUrl: "https://example.com/scans/demo-annotated.jpg",
        skinScore: t.skinScore,
        analysisResults: t.analysisResults,
        createdAt,
      });
    }
    if (have < 3) {
      console.log(
        `✓ Added ${3 - have} skin scan(s) for demo patient (minimum 3 rows with different dates)`
      );
    } else {
      console.log("✓ Skin scans already present (≥3); skipping seed inserts");
    }

    // 3. Appointments (only if none yet)
    const existingAppts = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.userId, patient.id))
      .limit(1);

    if (existingAppts.length === 0) {
      const now = new Date();
      const pastDate = new Date(now);
      pastDate.setDate(now.getDate() - 7);
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + 5);
      futureDate.setHours(14, 30, 0, 0);

      await db.insert(appointments).values([
        {
          userId: patient.id,
          doctorId: doctor.id,
          dateTime: pastDate,
          status: "completed",
          type: "consultation",
        },
        {
          userId: patient.id,
          doctorId: doctor.id,
          dateTime: futureDate,
          status: "scheduled",
          type: "follow-up",
        },
      ]);
      console.log("✓ Created 2 appointments (1 past, 1 upcoming)");
    } else {
      console.log("✓ Appointments already present; skipping");
    }

    // 4. Daily log for today (once) — UTC-noon Date so PG `date` matches calendar day
    const today = dateOnlyFromYmd(localCalendarYmd());

    const existingLog = await db
      .select({ id: dailyLogs.id })
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, patient.id), eq(dailyLogs.date, today))
      )
      .limit(1);

    if (existingLog.length === 0) {
      await db.insert(dailyLogs).values({
        userId: patient.id,
        date: today,
        amRoutine: true,
        pmRoutine: false,
        mood: "Energized",
        sleepHours: 7,
        stressLevel: 4,
        waterGlasses: 8,
        journalEntry:
          "Feeling great today! The new skincare routine is really making a difference. Noticed less redness in the morning.",
      });
      console.log("✓ Created daily log for today");
    } else {
      console.log("✓ Daily log for today already present; skipping");
    }

    // 5. Visit history & doctor notes (same demo copy as UI; skip if row exists for that date)
    const visitSeeds = [
      {
        ymd: "2025-10-15",
        doctorName: "Dr. Ruby Sachdev",
        notes:
          "Skin is responding well to the new PM routine. Increasing hydration serum to twice daily. Acne lesions reduced by ~40%. Continue current treatment.",
      },
      {
        ymd: "2025-10-01",
        doctorName: "Dr. Ruby Sachdev",
        notes:
          "Baseline assessment complete. Started gentle cleanser + Vitamin C + SPF for AM. Retinol 0.3% introduced for PM. Follow-up in 2 weeks.",
      },
      {
        ymd: "2025-09-20",
        doctorName: "Dr. Ruby Sachdev",
        notes:
          "Initial consultation. Skin type: combination. Primary concerns: acne, uneven tone. AI scan score: 72. Treatment plan discussed.",
      },
    ];

    let visitNotesInserted = 0;
    for (const v of visitSeeds) {
      const visitDate = dateOnlyFromYmd(v.ymd);
      const existing = await db
        .select({ id: visitNotes.id })
        .from(visitNotes)
        .where(
          and(
            eq(visitNotes.userId, patient.id),
            eq(visitNotes.visitDate, visitDate)
          )
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(visitNotes).values({
          userId: patient.id,
          visitDate,
          doctorName: v.doctorName,
          notes: v.notes,
        });
        visitNotesInserted += 1;
      }
    }
    if (visitNotesInserted > 0) {
      console.log(`✓ Added ${visitNotesInserted} visit note(s) for demo patient`);
    } else {
      console.log("✓ Visit notes already present for demo dates; skipping");
    }

    // 6. Priority reminders (schedules page checklist)
    let remindersInserted = 0;
    for (const r of DEFAULT_PRIORITY_REMINDERS) {
      const exists = await db
        .select({ id: priorityReminders.id })
        .from(priorityReminders)
        .where(
          and(
            eq(priorityReminders.userId, patient.id),
            eq(priorityReminders.sortOrder, r.sortOrder)
          )
        )
        .limit(1);
      if (exists.length === 0) {
        await db.insert(priorityReminders).values({
          userId: patient.id,
          title: r.title,
          priority: r.priority,
          sortOrder: r.sortOrder,
          completed: false,
        });
        remindersInserted += 1;
      }
    }
    if (remindersInserted > 0) {
      console.log(`✓ Added ${remindersInserted} priority reminder(s)`);
    } else {
      console.log("✓ Priority reminders already present; skipping");
    }

    // 7. Schedule / calendar events (this month + next month from seed run date)
    let scheduleInserted = 0;
    for (const s of getDefaultScheduleEvents()) {
      const eventDate = dateOnlyFromYmd(s.ymd);
      const exists = await db
        .select({ id: scheduleEvents.id })
        .from(scheduleEvents)
        .where(
          and(
            eq(scheduleEvents.userId, patient.id),
            eq(scheduleEvents.eventDate, eventDate),
            eq(scheduleEvents.title, s.title)
          )
        )
        .limit(1);
      if (exists.length === 0) {
        await db.insert(scheduleEvents).values({
          userId: patient.id,
          eventDate,
          eventTimeHm: s.timeHm,
          title: s.title,
          completed: false,
        });
        scheduleInserted += 1;
      } else {
        await db
          .update(scheduleEvents)
          .set({ eventTimeHm: s.timeHm })
          .where(
            and(
              eq(scheduleEvents.userId, patient.id),
              eq(scheduleEvents.eventDate, eventDate),
              eq(scheduleEvents.title, s.title),
              isNull(scheduleEvents.eventTimeHm)
            )
          );
      }
    }
    if (scheduleInserted > 0) {
      console.log(`✓ Added ${scheduleInserted} schedule event(s)`);
    } else {
      console.log("✓ Schedule events already present; skipping");
    }

    console.log("\n✅ Seeding completed successfully!");
    console.log("\nPatient demo login (email only for now):");
    console.log(`  Email: ${DEMO_PATIENT_EMAIL}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }

  process.exit(0);
}

seed();
