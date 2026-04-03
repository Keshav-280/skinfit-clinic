import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  serial,
  jsonb,
  boolean,
  date,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["patient", "doctor", "admin"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const appointmentTypeEnum = pgEnum("appointment_type", [
  "consultation",
  "follow-up",
  "scan-review",
]);

export const reminderPriorityEnum = pgEnum("reminder_priority", [
  "high",
  "medium",
  "low",
]);

// Appointment Requests (clinic approval workflow)
export const appointmentRequestStatusEnum = pgEnum(
  "appointment_request_status",
  ["pending", "approved", "cancelled"]
);

// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  /** E.164-style country calling code, e.g. +91 */
  phoneCountryCode: varchar("phone_country_code", { length: 8 })
    .notNull()
    .default("+91"),
  /** National / local number digits (no country code). */
  phone: varchar("phone", { length: 32 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("patient"),
  /** Optional profile fields (editable on /dashboard/profile). */
  age: integer("age"),
  skinType: varchar("skin_type", { length: 100 }),
  primaryGoal: varchar("primary_goal", { length: 255 }),
  /**
   * Hours before a scheduled visit to post a Clinic Support reminder (chat).
   * Default 24 (one day). Set to 0 to turn reminders off.
   */
  appointmentReminderHoursBefore: integer("appointment_reminder_hours_before")
    .notNull()
    .default(24),
  /** Expo push token for native app alerts (nullable). */
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Scans (dummy scanner / AI skin analysis results)
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  scanName: varchar("scan_name", { length: 255 }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  overallScore: integer("overall_score").notNull(),
  acne: integer("acne").notNull(),
  pigmentation: integer("pigmentation").notNull(),
  wrinkles: integer("wrinkles").notNull(),
  hydration: integer("hydration").notNull(),
  texture: integer("texture").notNull(),
  aiSummary: text("ai_summary"),
  /** Full Roboflow / AI score object (optional; legacy scans may omit) */
  scores: jsonb("scores").$type<{
    acneAndInflammation: number;
    wrinkles: number;
    pigmentation: number;
    hydration: number;
    overallHealth: number;
  }>(),
  /** Bounding-box annotations from Roboflow (optional) */
  annotations: jsonb("annotations").$type<unknown[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Skin scans (AI face scans - legacy)
export const skinScans = pgTable("skin_scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  originalImageUrl: text("original_image_url").notNull(),
  annotatedImageUrl: text("annotated_image_url").notNull(),
  skinScore: integer("skin_score").notNull(), // 0–100
  analysisResults: jsonb("analysis_results").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Daily logs (for dashboard) — one row per user per calendar day; re-saves update that row.
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "date" }).notNull(),
    amRoutine: boolean("am_routine").notNull().default(false),
    pmRoutine: boolean("pm_routine").notNull().default(false),
    mood: varchar("mood", { length: 100 }).notNull(),
    /** Per-step completion for AM_ROUTINE_ITEMS (same order). */
    routineAmSteps: jsonb("routine_am_steps").$type<boolean[]>(),
    /** Per-step completion for PM_ROUTINE_ITEMS (same order). */
    routinePmSteps: jsonb("routine_pm_steps").$type<boolean[]>(),
    /** Hours of sleep (whole hours). */
    sleepHours: integer("sleep_hours").notNull().default(0),
    /** Self-reported stress 1–10. */
    stressLevel: integer("stress_level").notNull().default(5),
    /** Water intake in glasses. */
    waterGlasses: integer("water_glasses").notNull().default(0),
    journalEntry: text("journal_entry"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_logs_user_id_date_uidx").on(
      table.userId,
      table.date
    ),
  })
);

// Appointments
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Patient
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Doctor (also from users table)
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  dateTime: timestamp("date_time", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  type: appointmentTypeEnum("type").notNull().default("consultation"),

  /** When the automated Clinic Support pre-visit reminder was sent (once per appointment). */
  clinicReminderSentAt: timestamp("clinic_reminder_sent_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Doctor appointment slots (clinic feeds a timetable; patients request from slots)
export const doctorSlots = pgTable(
  "doctor_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slotDate: date("slot_date", { mode: "date" }).notNull(),
    /** Local time of day `HH:mm` (24h), e.g. `14:30`. */
    slotTimeHm: varchar("slot_time", { length: 5 }).notNull(),
    /** Optional end time same day; if null, clients use start + 30 minutes. */
    slotEndTimeHm: varchar("slot_end_time", { length: 5 }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    doctorSlotUniqueIdx: uniqueIndex("doctor_slots_doctor_date_time_uidx").on(
      table.doctorId,
      table.slotDate,
      table.slotTimeHm
    ),
  })
);

// Appointment requests created by patient; manually approved/cancelled by clinic
export const appointmentRequests = pgTable(
  "appointment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    doctorSlotId: uuid("doctor_slot_id")
      .notNull()
      .references(() => doctorSlots.id, { onDelete: "restrict" }),

    issue: text("issue").notNull(),
    why: text("why"),

    status: appointmentRequestStatusEnum("status")
      .notNull()
      .default("pending"),

    appointmentId: uuid("appointment_id"),

    cancelledReason: text("cancelled_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    patientDoctorSlotUidx: uniqueIndex(
      "appointment_requests_patient_doctor_slot_uidx"
    ).on(table.patientId, table.doctorId, table.doctorSlotId),
  })
);

/** Doctor visit notes shown on patient treatment history (per visit date). */
export const visitNotes = pgTable("visit_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  visitDate: date("visit_date", { mode: "date" }).notNull(),
  doctorName: varchar("doctor_name", { length: 255 }).notNull(),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Dashboard “Priority reminders” checklist (per user, ordered). */
export const priorityReminders = pgTable(
  "priority_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    priority: reminderPriorityEnum("priority").notNull().default("medium"),
    sortOrder: integer("sort_order").notNull(),
    completed: boolean("completed").notNull().default(false),
    /** When the user marked the reminder done (for history). */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userSortUidx: uniqueIndex("priority_reminders_user_sort_uidx").on(
      table.userId,
      table.sortOrder
    ),
  })
);

/** Calendar / “Upcoming schedule” entries (patient-facing; can be synced from another app). */
export const scheduleEvents = pgTable("schedule_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventDate: date("event_date", { mode: "date" }).notNull(),
  /** Local time of day `HH:mm` (24h), e.g. `14:30`. Null = all-day. */
  eventTimeHm: varchar("event_time", { length: 5 }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations: users <-> scans (one-to-many)
export const usersRelations = relations(users, ({ many }) => ({
  scans: many(scans),
}));

export const scansRelations = relations(scans, ({ one }) => ({
  user: one(users),
}));

// Chat (plain message history; Dr. Ruby & Clinic Support)
export const chatAssistantEnum = pgEnum("chat_assistant_id", [
  "ai",
  "doctor",
  "support",
]);

export const chatSenderEnum = pgEnum("chat_sender", [
  "patient",
  "doctor",
  "support",
]);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: chatAssistantEnum("assistant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Patient-only: hide messages at or before this time in the app. Rows stay in DB;
     * clinic/dev tools still see full history.
     */
    patientClearedChatAt: timestamp("patient_cleared_chat_at", {
      withTimezone: true,
    }),
  }
);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  sender: chatSenderEnum("sender").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});