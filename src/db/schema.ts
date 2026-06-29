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
  real,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

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

/** Patient-requested visit date (CRM confirms via sheet webhook). */
export const patientScheduleRequestStatusEnum = pgEnum(
  "patient_schedule_request_status",
  ["pending", "confirmed", "cancelled", "declined"]
);

export const parameterSourceEnum = pgEnum("parameter_source", [
  "ai",
  "doctor",
  "pending",
]);

export const visitResponseRatingEnum = pgEnum("visit_response_rating", [
  "excellent",
  "good",
  "moderate",
  "poor",
]);

export const resourceKindEnum = pgEnum("resource_kind", [
  "article",
  "video",
  "insight",
]);

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
  /** Null for OAuth-only accounts (Google, Apple, etc.). */
  passwordHash: varchar("password_hash", { length: 255 }),
  role: userRoleEnum("role").notNull().default("patient"),
  /** Optional profile fields (editable on /dashboard/profile). */
  age: integer("age"),
  gender: varchar("gender", { length: 24 }),
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
  /**
   * IANA timezone for routine reminder wall-clock times (e.g. Asia/Kolkata).
   */
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
  /** Daily AM/PM routine nudges in Clinic Support chat. */
  routineRemindersEnabled: boolean("routine_reminders_enabled")
    .notNull()
    .default(true),
  /** Local time of day `HH:mm` (24h) for AM routine reminder. */
  routineAmReminderHm: varchar("routine_am_reminder_hm", { length: 5 })
    .notNull()
    .default("08:30"),
  /** Local time of day `HH:mm` (24h) for PM routine reminder. */
  routinePmReminderHm: varchar("routine_pm_reminder_hm", { length: 5 })
    .notNull()
    .default("22:00"),
  /** Last calendar day (YYYY-MM-DD in user's timezone) we sent the AM routine reminder. */
  routineAmReminderLastSentYmd: varchar("routine_am_reminder_last_sent_ymd", {
    length: 10,
  }),
  /** Last calendar day we sent the PM routine reminder. */
  routinePmReminderLastSentYmd: varchar("routine_pm_reminder_last_sent_ymd", {
    length: 10,
  }),
  /** kAI onboarding: false until questionnaire + baseline scan complete. Existing users default true. */
  onboardingComplete: boolean("onboarding_complete").notNull().default(true),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  /** InsightFace embedding (512-d) from onboarding centre photo — identity gate for later scans. */
  faceReferenceEmbedding: jsonb("face_reference_embedding").$type<number[] | null>(),
  faceReferenceImagePath: text("face_reference_image_path"),
  faceReferenceSetAt: timestamp("face_reference_set_at", { withTimezone: true }),
  /**
   * AM/PM routine step labels — set by clinic after onboarding. Null until configured;
   * patients see an empty checklist until both sides have at least one step.
   */
  routinePlanAmItems: jsonb("routine_plan_am_items").$type<string[] | null>(),
  routinePlanPmItems: jsonb("routine_plan_pm_items").$type<string[] | null>(),
  /**
   * When false, cron reapplies `AM_ROUTINE_ITEMS` / `PM_ROUTINE_ITEMS` from code so the
   * checklist stays current until a clinician saves a personal plan.
   */
  routinePlanClinicianLocked: boolean("routine_plan_clinician_locked")
    .notNull()
    .default(false),
  primaryConcern: varchar("primary_concern", { length: 64 }),
  /** All selected onboarding concerns (first item mirrors primary_concern for legacy reads). */
  concerns: jsonb("concerns").$type<string[]>(),
  concernSeverity: varchar("concern_severity", { length: 32 }),
  concernDuration: varchar("concern_duration", { length: 32 }),
  triggers: jsonb("triggers").$type<string[]>(),
  priorTreatment: varchar("prior_treatment", { length: 8 }),
  treatmentHistoryText: text("treatment_history_text"),
  treatmentHistoryDuration: varchar("treatment_history_duration", { length: 32 }),
  skinSensitivity: varchar("skin_sensitivity", { length: 32 }),
  baselineSleep: varchar("baseline_sleep", { length: 32 }),
  baselineHydration: varchar("baseline_hydration", { length: 32 }),
  baselineDietType: varchar("baseline_diet_type", { length: 32 }),
  baselineSunExposure: varchar("baseline_sun_exposure", { length: 32 }),
  fitzpatrick: varchar("fitzpatrick", { length: 8 }),
  streakCurrent: integer("streak_current").notNull().default(0),
  streakLongest: integer("streak_longest").notNull().default(0),
  streakLastDate: date("streak_last_date", { mode: "date" }),
  cycleTrackingEnabled: boolean("cycle_tracking_enabled").notNull().default(false),
  /** When patient last viewed doctor feedback (for “new” badge). */
  doctorFeedbackViewedAt: timestamp("doctor_feedback_viewed_at", {
    withTimezone: true,
  }),
  /** General written feedback shown on patient home dashboard (separate from per-visit notes). */
  doctorFeedbackNote: text("doctor_feedback_note"),
  doctorFeedbackUpdatedAt: timestamp("doctor_feedback_updated_at", {
    withTimezone: true,
  }),
  /** When patient last acknowledged scan/report voice notes (inbox + history). */
  doctorFeedbackScanVoiceViewedAt: timestamp(
    "doctor_feedback_scan_voice_viewed_at",
    { withTimezone: true }
  ),
  /**
   * When patient last opened Schedules (clears “new CRM note” bell for confirmed visits).
   */
  scheduleCrmDigestAt: timestamp("schedule_crm_digest_at", { withTimezone: true }),
  /** Doctor portal: last time staff cleared the patient-scan inbox bell. */
  doctorPortalScansInboxSeenAt: timestamp("doctor_portal_scans_inbox_seen_at", {
    withTimezone: true,
  }),
  profilePhotoUrl: text("profile_photo_url"),
  /** Set by doctor portal when marking a patient as "Visited". */
  clinicVisitedAt: timestamp("clinic_visited_at", { withTimezone: true }),
  /**
   * Primary clinician for patient-portal doctor chat, feedback, and scoped reports.
   * Updated when a new doctor–patient care link is established (e.g. approved booking).
   */
  assignedDoctorId: uuid("assigned_doctor_id").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthProviderEnum = pgEnum("oauth_provider", [
  "google",
  "apple",
  "facebook",
  "github",
  "microsoft",
]);

/** Links a SkinFit user to an external identity provider (Google, Apple, …). */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    /** Stable subject id from the provider (e.g. Google `sub`). */
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    /** Email returned by the provider at link time (may differ from user.email for Apple relay). */
    providerEmail: varchar("provider_email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerAccountUidx: uniqueIndex("oauth_accounts_provider_account_uidx").on(
      table.provider,
      table.providerAccountId
    ),
    userIdIdx: index("oauth_accounts_user_id_idx").on(table.userId),
  })
);

/** Isolated doctor↔patient relationship — separate chats, feedback, visits per pair. */
export const doctorPatientCare = pgTable(
  "doctor_patient_care",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    doctorFeedbackNote: text("doctor_feedback_note"),
    doctorFeedbackUpdatedAt: timestamp("doctor_feedback_updated_at", {
      withTimezone: true,
    }),
    doctorFeedbackViewedAt: timestamp("doctor_feedback_viewed_at", {
      withTimezone: true,
    }),
    clinicVisitedAt: timestamp("clinic_visited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    doctorPatientUidx: uniqueIndex("doctor_patient_care_doctor_patient_uidx").on(
      table.doctorId,
      table.patientId
    ),
    doctorIdx: index("doctor_patient_care_doctor_idx").on(table.doctorId),
    patientIdx: index("doctor_patient_care_patient_idx").on(table.patientId),
  })
);

// Scans (dummy scanner / AI skin analysis results)
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  scanName: varchar("scan_name", { length: 255 }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Clinician who owns this scan in their portal (patient sees scans for assigned doctor). */
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  imageUrl: text("image_url").notNull(),
  /**
   * Ordered face captures — file paths/URLs only (no base64).
   * Legacy rows may still use dataUri; readers should resolve via resolveScanImageUrl().
   */
  faceCaptureImages: jsonb("face_capture_images").$type<
    Array<{
      label: string;
      /** New rows: file URL/path only */
      imageUrl?: string;
      previewUrl?: string;
      /** Legacy rows: inline base64 (do not write for new scans) */
      dataUri?: string;
      previewDataUri?: string;
    }>
  >(),
  overallScore: integer("overall_score").notNull(),
  acne: integer("acne").notNull(),
  pigmentation: integer("pigmentation").notNull(),
  wrinkles: integer("wrinkles").notNull(),
  hydration: integer("hydration").notNull(),
  texture: integer("texture").notNull(),
  aiSummary: text("ai_summary"),
  /** Optional extended scores (legacy Roboflow + clinical 1–5 features) */
  scores: jsonb("scores").$type<{
    acneAndInflammation?: number;
    wrinkles?: number;
    pigmentation?: number;
    hydration?: number;
    overallHealth?: number;
    overallKaiScore?: number;
    kaiParams?: Record<string, unknown>;
    modelFeatureScores?: Record<string, number | null>;
    /** Wrinkle + acne overlay — local/R2 URLs only */
    overlayUrl?: string;
    wrinkleMaskUrl?: string;
    acneMaskUrl?: string;
    /** Unclipped inference acne mask — used to re-clip when algorithm changes. */
    acneMaskOriginalUrl?: string;
    acneMaskFaceClipVersion?: number;
    acneMaskFaceRestricted?: boolean;
    wrinkleMaskFaceRestricted?: boolean;
    /** @deprecated legacy base64 */
    overlayDataUri?: string;
    wrinkleMaskDataUri?: string;
    acneMaskDataUri?: string;
    /** 2 = title-free JPEG masks; absent/1 = legacy matplotlib PNG export. */
    maskExportVersion?: number;
    spatialOutputs?: {
      wrinkles: Record<string, unknown>;
      acne: Record<string, unknown>;
    };
    /** Doctor portal score overrides (severity 1–5 + kAI 0–100). */
    doctorOverrides?: {
      kaiScore?: number;
      modelFeatureScores?: Record<string, number | null>;
    };
  }>(),
  /** Bounding-box annotations from Roboflow (optional) */
  annotations: jsonb("annotations").$type<unknown[]>(),
  /**
   * Frozen kAI tracker report (focus actions, week deltas, resources) built once when
   * the scan is saved — avoids rebuilding on every report view.
   */
  trackerSnapshot: jsonb("tracker_snapshot").$type<PatientTrackerReport | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scanJobStatusEnum = pgEnum("scan_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const scanJobs = pgTable("scan_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: scanJobStatusEnum("status").notNull().default("pending"),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  resultScanId: integer("result_scan_id").references(() => scans.id, {
    onDelete: "set null",
  }),
  errorText: text("error_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

/** Versioned AM/PM routine plans — each revision applies from `effectiveFrom` onward. */
export const routinePlanRevisions = pgTable(
  "routine_plan_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** First calendar day this revision applies (inclusive). */
    effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
    amItems: jsonb("am_items").$type<string[]>().notNull(),
    pmItems: jsonb("pm_items").$type<string[]>().notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userEffectiveIdx: index("routine_plan_revisions_user_effective_idx").on(
      table.userId,
      table.effectiveFrom
    ),
    userEffectiveUidx: uniqueIndex(
      "routine_plan_revisions_user_effective_uidx"
    ).on(table.userId, table.effectiveFrom),
  })
);

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
    /** Hours of sleep (supports half-hours e.g. 6.5). */
    sleepHours: real("sleep_hours").notNull().default(0),
    /** Self-reported sleep quality: very_poor | average | excellent */
    sleepQuality: varchar("sleep_quality", { length: 32 }),
    /** Self-reported stress 1–10. */
    stressLevel: integer("stress_level").notNull().default(5),
    /** Water intake in glasses. */
    waterGlasses: integer("water_glasses").notNull().default(0),
    journalEntry: text("journal_entry"),
    dietType: varchar("diet_type", { length: 32 }),
    sunExposure: varchar("sun_exposure", { length: 32 }),
    cycleDay: integer("cycle_day"),
    comments: text("comments"),
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
  /** Same-day end time in clinic wall clock `HH:mm`; null → clients use start + 30 minutes. */
  slotEndTimeHm: varchar("slot_end_time", { length: 5 }),
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  type: appointmentTypeEnum("type").notNull().default("consultation"),

  /** Patient message after booking (e.g. time not viable); mirrored to CRM sheet when configured. */
  patientClinicNote: text("patient_clinic_note"),
  patientClinicNoteAt: timestamp("patient_clinic_note_at", { withTimezone: true }),

  /** When the automated Clinic Support pre-visit reminder was sent (once per appointment). */
  clinicReminderSentAt: timestamp("clinic_reminder_sent_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patientScheduleRequests = pgTable(
  "patient_schedule_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    preferredDate: date("preferred_date", { mode: "date" }).notNull(),
    issue: text("issue").notNull().default("Skin concern"),
    daysAffected: integer("days_affected"),
    timePreferences: text("time_preferences").notNull(),
    attachments: jsonb("attachments").$type<
      Array<{ fileName: string; mimeType: string; dataUri: string }>
    >(),
    status: patientScheduleRequestStatusEnum("status")
      .notNull()
      .default("pending"),
    externalRef: text("external_ref"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Pre-visit / CRM instructions sent when confirming via sheet webhook (`patientMessage`). */
    crmPatientMessage: text("crm_patient_message"),
    cancelledReason: text("cancelled_reason"),
    patientNotes: text("patient_notes"),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    patientIdx: index("patient_schedule_requests_patient_idx").on(table.patientId),
    statusIdx: index("patient_schedule_requests_status_idx").on(table.status),
    externalRefIdx: index("patient_schedule_requests_external_ref_idx").on(
      table.externalRef
    ),
  })
);

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
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  visitDate: date("visit_date", { mode: "date" }).notNull(),
  doctorName: varchar("doctor_name", { length: 255 }).notNull(),
  notes: text("notes").notNull(),
  purpose: text("purpose"),
  treatments: text("treatments"),
  preAdvice: text("pre_advice"),
  postAdvice: text("post_advice"),
  prescription: text("prescription"),
  responseRating: visitResponseRatingEnum("response_rating"),
  beforeImageIds: jsonb("before_image_ids").$type<string[]>(),
  afterImageIds: jsonb("after_image_ids").$type<string[]>(),
  /** Optional clinician uploads (data URIs), max few MB total — see API limits. */
  attachments: jsonb("attachments").$type<
    Array<{ fileName: string; mimeType: string; dataUri: string }>
  >(),
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
  /** `general` | `pre_treatment` | `post_treatment` — clinician-added care schedules. */
  eventKind: varchar("event_kind", { length: 32 }).notNull().default("general"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Clinical annotator image library (R2/local paths in file_url; legacy data_uri rows). */
export const annotatorImages = pgTable(
  "annotator_images",
  {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileUrl: text("file_url"),
    /** Legacy inline image; new rows use file_url only */
    dataUri: text("data_uri"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sortOrderUidx: uniqueIndex("annotator_images_sort_order_uidx").on(table.sortOrder),
  })
);

/** Single persisted working state used by the annotator UI. */
export const annotatorState = pgTable(
  "annotator_state",
  {
    id: serial("id").primaryKey(),
    scope: varchar("scope", { length: 64 }).notNull().default("default"),
    perImageByCategory: jsonb("per_image_by_category").$type<
      Record<string, Record<string, { spec?: string; grade?: string; score?: number }>>
    >(),
    annotations: jsonb("annotations").$type<
      Array<{
        id: string;
        imageIndex: number;
        category: string;
        spec: string;
        severity: string;
        color: string;
        type: "path" | "line";
        points: Array<{ x: number; y: number }>;
      }>
    >(),
    currentIndex: integer("current_index").notNull().default(0),
    /** userId -> sparse imageIndex -> category labels */
    perUserLabels: jsonb("per_user_labels")
      .$type<Record<string, Record<string, Record<string, { spec?: string; grade?: string }>>>>()
      .notNull()
      .default({}),
    /** userId -> shape list */
    perUserShapes: jsonb("per_user_shapes")
      .$type<
        Record<
          string,
          Array<{
            id: string;
            imageIndex: number;
            category: string;
            spec: string;
            severity: string;
            color: string;
            type: "path" | "line";
            points: Array<{ x: number; y: number }>;
          }>
        >
      >()
      .notNull()
      .default({}),
    /** imageIndex -> lock holder */
    imageLocks: jsonb("image_locks")
      .$type<
        Record<
          string,
          { userId: string; userName: string; expiresAt: string }
        >
      >()
      .notNull()
      .default({}),
    /** userId -> ISO last sync */
    userSyncAt: jsonb("user_sync_at").$type<Record<string, string>>().notNull().default({}),
    /** userId -> shape ids removed remotely (admin delete); blocks stale client restore */
    shapeTombstones: jsonb("shape_tombstones")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scopeUidx: uniqueIndex("annotator_state_scope_uidx").on(table.scope),
  })
);

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
    /** Doctor portal: last time staff opened this thread from inbox / patient page; hides bell until a newer patient message. */
    doctorPortalLastReadAt: timestamp("doctor_portal_last_read_at", {
      withTimezone: true,
    }),
    /** Per-doctor thread when assistantId is doctor (one thread per doctor–patient pair). */
    doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "cascade" }),
  }
);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  sender: chatSenderEnum("sender").notNull(),
  text: text("text").notNull(),
  isUrgent: boolean("is_urgent").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Per-user RSA public key for doctor↔patient chat E2EE. Private key stays on device. */
export const chatUserE2eeKeys = pgTable("chat_user_e2ee_keys", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKeyJwk: text("public_key_jwk").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** AES thread key wrapped for each participant (RSA-OAEP). */
export const chatThreadE2eeEnvelopes = pgTable(
  "chat_thread_e2ee_envelopes",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wrappedKeyB64: text("wrapped_key_b64").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.threadId, table.userId] }),
  })
);

/** Staff marked “seen” for a specific urgent SOS chat row (per-doctor, per-message). */
export const doctorSosAcknowledgements = pgTable(
  "doctor_sos_acknowledgements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatMessageId: uuid("chat_message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    staffMessageUidx: uniqueIndex("doctor_sos_ack_staff_message_uidx").on(
      table.staffUserId,
      table.chatMessageId
    ),
    staffIdx: index("doctor_sos_ack_staff_idx").on(table.staffUserId),
  })
);

/** Questionnaire step answers (audit trail). */
export const questionnaireAnswers = pgTable("questionnaire_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionId: varchar("question_id", { length: 64 }).notNull(),
  answer: jsonb("answer").notNull(),
  questionnaireVersion: integer("questionnaire_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One Skin DNA summary per patient (updated in place). */
export const skinDnaCards = pgTable(
  "skin_dna_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
    skinType: varchar("skin_type", { length: 64 }),
    primaryConcern: text("primary_concern"),
    sensitivityIndex: integer("sensitivity_index"),
    uvSensitivity: varchar("uv_sensitivity", { length: 32 }),
    hormonalCorrelation: varchar("hormonal_correlation", { length: 32 }),
    revision: integer("revision").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDoctorUidx: uniqueIndex("skin_dna_cards_user_doctor_uidx").on(
      table.userId,
      table.doctorId
    ),
  })
);

/** Per-scan kAI parameter row (12 rows per scan when complete). */
export const parameterScores = pgTable(
  "parameter_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: integer("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    paramKey: varchar("param_key", { length: 64 }).notNull(),
    value: integer("value"),
    source: parameterSourceEnum("source").notNull().default("pending"),
    severityFlag: boolean("severity_flag").notNull().default(false),
    deltaVsPrev: integer("delta_vs_prev"),
    extras: jsonb("extras").$type<Record<string, unknown>>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scanParamUidx: uniqueIndex("parameter_scores_scan_param_uidx").on(
      table.scanId,
      table.paramKey
    ),
  })
);

export const weeklyReports = pgTable("weekly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  weekStart: date("week_start", { mode: "date" }).notNull(),
  kaiScore: integer("kai_score"),
  weeklyDelta: integer("weekly_delta"),
  consistencyScore: integer("consistency_score"),
  causesJson: jsonb("causes_json").$type<unknown>(),
  focusActionsJson: jsonb("focus_actions_json").$type<unknown>(),
  resourcesJson: jsonb("resources_json").$type<unknown>(),
  narrativeText: text("narrative_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyFocus = pgTable(
  "daily_focus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    focusDate: date("focus_date", { mode: "date" }).notNull(),
    message: text("message").notNull(),
    sourceParam: varchar("source_param", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDateUidx: uniqueIndex("daily_focus_user_date_uidx").on(
      table.userId,
      table.focusDate
    ),
  })
);

export const hydrationInsights = pgTable(
  "hydration_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    insightDate: date("insight_date", { mode: "date" }).notNull(),
    insight: text("insight").notNull(),
    tip: text("tip").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDateUidx: uniqueIndex("hydration_insights_user_date_uidx").on(
      table.userId,
      table.insightDate
    ),
  })
);

export const doctorFeedbackVoiceNotes = pgTable("doctor_feedback_voice_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  scanId: integer("scan_id").references(() => scans.id, { onDelete: "set null" }),
  /** Local or R2 audio path — never store base64 here for new rows */
  audioUrl: text("audio_url"),
  /** @deprecated legacy inline audio */
  audioDataUri: text("audio_data_uri"),
  /** Written feedback text that accompanies (or replaces) the voice note. */
  feedbackText: text("feedback_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Patient marked as listened (separate from inbox; drives badge + archive). */
  patientListenedAt: timestamp("patient_listened_at", { withTimezone: true }),
  /** Patient archived — hidden from main lists; audio retained in DB. */
  patientArchivedAt: timestamp("patient_archived_at", { withTimezone: true }),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  monthStart: date("month_start", { mode: "date" }).notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Durable store for the expensive LLM+RAG profile insights (Key Observations +
 * Priority Actions). Redis is only a short-lived L1 cache; this table is the
 * last-good copy so a transient OpenAI/RAG failure does not blank the UI, and so
 * we regenerate only when a new scan arrives or the row goes stale (cost control).
 */
export const profileInsights = pgTable(
  "profile_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Number of scans the user had when this row was generated; used to detect "new scan since".
    scanCount: integer("scan_count").notNull().default(0),
    // Full payload: { keyObservations, priorityKnowDo } (same shapes the API returns).
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userUidx: uniqueIndex("profile_insights_user_uidx").on(table.userId),
  })
);

export const kaiResources = pgTable("kai_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  kind: resourceKindEnum("kind").notNull(),
  paramKeys: jsonb("param_keys").$type<string[]>(),
  tags: jsonb("tags").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Clinic family card — shared credit balance topped up / deducted at the clinic. */
export const familyWalletMemberRoleEnum = pgEnum("family_wallet_member_role", [
  "owner",
  "member",
]);

export const familyWalletTxTypeEnum = pgEnum("family_wallet_tx_type", [
  "topup",
  "deduction",
  "refund",
]);

export const familyWallets = pgTable(
  "family_wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 120 })
      .notNull()
      .default("Family card"),
    /** Spendable clinic credits (whole rupees / points). */
    balanceCredits: integer("balance_credits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ownerUidx: uniqueIndex("family_wallets_owner_uidx").on(table.ownerUserId),
  })
);

export const familyWalletMembers = pgTable(
  "family_wallet_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => familyWallets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: familyWalletMemberRoleEnum("role").notNull().default("member"),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    walletUserUidx: uniqueIndex("family_wallet_members_wallet_user_uidx").on(
      table.walletId,
      table.userId
    ),
    userUidx: uniqueIndex("family_wallet_members_user_uidx").on(table.userId),
  })
);

export const familyWalletTransactions = pgTable(
  "family_wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => familyWallets.id, { onDelete: "cascade" }),
    type: familyWalletTxTypeEnum("type").notNull(),
    /** Positive for top-up/refund; negative for deduction. */
    amountCredits: integer("amount_credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    /** Patient who received the service (for deductions). */
    patientUserId: uuid("patient_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Doctor/staff who performed the clinic action. */
    performedByUserId: uuid("performed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    walletCreatedIdx: index("family_wallet_tx_wallet_created_idx").on(
      table.walletId,
      table.createdAt
    ),
  })
);

export const mobileCaptureSessions = pgTable("mobile_capture_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  scanId: integer("scan_id").references(() => scans.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});