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
  index,
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
  /** Ordered face captures (labels + data URIs); null for legacy single-image scans */
  faceCaptureImages: jsonb("face_capture_images").$type<
    Array<{ label: string; dataUri: string; previewDataUri?: string }>
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
    modelFeatureScores?: Record<string, number | null>;
    /** Wrinkle + acne overlay JPEG (data URI) from Python analyzer */
    overlayDataUri?: string;
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
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Clinical annotator image library (stored as data URIs for persistence). */
export const annotatorImages = pgTable(
  "annotator_images",
  {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    dataUri: text("data_uri").notNull(),
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
      Record<string, Record<string, { spec?: string; score?: number }>>
    >(),
    annotations: jsonb("annotations").$type<
      Array<{
        id: string;
        imageIndex: number;
        category: string;
        spec: string;
        severity: number;
        color: string;
        type: "path" | "line";
        points: Array<{ x: number; y: number }>;
      }>
    >(),
    currentIndex: integer("current_index").notNull().default(0),
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
    userUidx: uniqueIndex("skin_dna_cards_user_id_uidx").on(table.userId),
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

export const doctorFeedbackVoiceNotes = pgTable("doctor_feedback_voice_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id").references(() => users.id, { onDelete: "set null" }),
  scanId: integer("scan_id").references(() => scans.id, { onDelete: "set null" }),
  audioDataUri: text("audio_data_uri").notNull(),
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
  monthStart: date("month_start", { mode: "date" }).notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kaiResources = pgTable("kai_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  kind: resourceKindEnum("kind").notNull(),
  paramKeys: jsonb("param_keys").$type<string[]>(),
  tags: jsonb("tags").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});