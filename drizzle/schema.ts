import { pgTable, uniqueIndex, serial, varchar, text, integer, timestamp, jsonb, foreignKey, uuid, date, boolean, real, index, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appointmentRequestStatus = pgEnum("appointment_request_status", ['pending', 'approved', 'cancelled'])
export const appointmentStatus = pgEnum("appointment_status", ['scheduled', 'completed', 'cancelled'])
export const appointmentType = pgEnum("appointment_type", ['consultation', 'follow-up', 'scan-review'])
export const chatAssistantId = pgEnum("chat_assistant_id", ['ai', 'doctor', 'support'])
export const chatSender = pgEnum("chat_sender", ['patient', 'doctor', 'support'])
export const parameterSource = pgEnum("parameter_source", ['ai', 'doctor', 'pending'])
export const patientScheduleRequestStatus = pgEnum("patient_schedule_request_status", ['pending', 'confirmed', 'cancelled', 'declined'])
export const reminderPriority = pgEnum("reminder_priority", ['high', 'medium', 'low'])
export const resourceKind = pgEnum("resource_kind", ['article', 'video', 'insight'])
export const userRole = pgEnum("user_role", ['patient', 'doctor', 'admin'])
export const visitResponseRating = pgEnum("visit_response_rating", ['excellent', 'good', 'moderate', 'poor'])


export const annotatorImages = pgTable("annotator_images", {
	id: serial().primaryKey().notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	dataUri: text("data_uri"),
	sortOrder: integer("sort_order").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("annotator_images_sort_order_uidx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
]);

export const annotatorState = pgTable("annotator_state", {
	id: serial().primaryKey().notNull(),
	scope: varchar({ length: 64 }).default('default').notNull(),
	perImageByCategory: jsonb("per_image_by_category"),
	annotations: jsonb(),
	currentIndex: integer("current_index").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("annotator_state_scope_uidx").using("btree", table.scope.asc().nullsLast().op("text_ops")),
]);

export const doctorSlots = pgTable("doctor_slots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	slotDate: date("slot_date").notNull(),
	slotTime: varchar("slot_time", { length: 5 }).notNull(),
	slotEndTime: varchar("slot_end_time", { length: 5 }),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("doctor_slots_doctor_date_time_uidx").using("btree", table.doctorId.asc().nullsLast().op("date_ops"), table.slotDate.asc().nullsLast().op("uuid_ops"), table.slotTime.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "doctor_slots_doctor_id_users_id_fk"
		}).onDelete("restrict"),
]);

export const chatThreads = pgTable("chat_threads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	assistantId: chatAssistantId("assistant_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	patientClearedChatAt: timestamp("patient_cleared_chat_at", { withTimezone: true, mode: 'string' }),
	doctorPortalLastReadAt: timestamp("doctor_portal_last_read_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chat_threads_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const dailyFocus = pgTable("daily_focus", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	focusDate: date("focus_date").notNull(),
	message: text().notNull(),
	sourceParam: varchar("source_param", { length: 64 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("daily_focus_user_date_uidx").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.focusDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "daily_focus_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const hydrationInsights = pgTable("hydration_insights", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	insightDate: date("insight_date").notNull(),
	insight: text().notNull(),
	tip: text().notNull(),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("hydration_insights_user_date_uidx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.insightDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "hydration_insights_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const dailyLogs = pgTable("daily_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	amRoutine: boolean("am_routine").default(false).notNull(),
	pmRoutine: boolean("pm_routine").default(false).notNull(),
	mood: varchar({ length: 100 }).notNull(),
	routineAmSteps: jsonb("routine_am_steps"),
	routinePmSteps: jsonb("routine_pm_steps"),
	sleepHours: real("sleep_hours").default(0).notNull(),
	stressLevel: integer("stress_level").default(5).notNull(),
	waterGlasses: integer("water_glasses").default(0).notNull(),
	journalEntry: text("journal_entry"),
	dietType: varchar("diet_type", { length: 32 }),
	sunExposure: varchar("sun_exposure", { length: 32 }),
	cycleDay: integer("cycle_day"),
	comments: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("daily_logs_user_id_date_uidx").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "daily_logs_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const doctorSosAcknowledgements = pgTable("doctor_sos_acknowledgements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	staffUserId: uuid("staff_user_id").notNull(),
	chatMessageId: uuid("chat_message_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("doctor_sos_ack_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("doctor_sos_ack_staff_message_uidx").using("btree", table.staffUserId.asc().nullsLast().op("uuid_ops"), table.chatMessageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [users.id],
			name: "doctor_sos_acknowledgements_staff_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatMessageId],
			foreignColumns: [chatMessages.id],
			name: "doctor_sos_acknowledgements_chat_message_id_chat_messages_id_fk"
		}).onDelete("cascade"),
]);

export const appointments = pgTable("appointments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	doctorId: uuid("doctor_id").notNull(),
	dateTime: timestamp("date_time", { withTimezone: true, mode: 'string' }).notNull(),
	slotEndTime: varchar("slot_end_time", { length: 5 }),
	status: appointmentStatus().default('scheduled').notNull(),
	type: appointmentType().default('consultation').notNull(),
	patientClinicNote: text("patient_clinic_note"),
	patientClinicNoteAt: timestamp("patient_clinic_note_at", { withTimezone: true, mode: 'string' }),
	clinicReminderSentAt: timestamp("clinic_reminder_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "appointments_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "appointments_doctor_id_users_id_fk"
		}).onDelete("restrict"),
]);

export const doctorFeedbackVoiceNotes = pgTable("doctor_feedback_voice_notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	doctorId: uuid("doctor_id"),
	scanId: integer("scan_id"),
	audioDataUri: text("audio_data_uri"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	patientListenedAt: timestamp("patient_listened_at", { withTimezone: true, mode: 'string' }),
	patientArchivedAt: timestamp("patient_archived_at", { withTimezone: true, mode: 'string' }),
	feedbackText: text("feedback_text"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "doctor_feedback_voice_notes_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "doctor_feedback_voice_notes_doctor_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.scanId],
			foreignColumns: [scans.id],
			name: "doctor_feedback_voice_notes_scan_id_scans_id_fk"
		}).onDelete("set null"),
]);

export const kaiResources = pgTable("kai_resources", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	url: text().notNull(),
	kind: resourceKind().notNull(),
	paramKeys: jsonb("param_keys"),
	tags: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const parameterScores = pgTable("parameter_scores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	scanId: integer("scan_id").notNull(),
	paramKey: varchar("param_key", { length: 64 }).notNull(),
	value: integer(),
	source: parameterSource().default('pending').notNull(),
	severityFlag: boolean("severity_flag").default(false).notNull(),
	deltaVsPrev: integer("delta_vs_prev"),
	extras: jsonb(),
	recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("parameter_scores_scan_param_uidx").using("btree", table.scanId.asc().nullsLast().op("int4_ops"), table.paramKey.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.scanId],
			foreignColumns: [scans.id],
			name: "parameter_scores_scan_id_scans_id_fk"
		}).onDelete("cascade"),
]);

export const patientScheduleRequests = pgTable("patient_schedule_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientId: uuid("patient_id").notNull(),
	doctorId: uuid("doctor_id"),
	preferredDate: date("preferred_date").notNull(),
	issue: text().default('Skin concern').notNull(),
	daysAffected: integer("days_affected"),
	timePreferences: text("time_preferences").notNull(),
	attachments: jsonb(),
	status: patientScheduleRequestStatus().default('pending').notNull(),
	externalRef: text("external_ref"),
	confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: 'string' }),
	crmPatientMessage: text("crm_patient_message"),
	cancelledReason: text("cancelled_reason"),
	appointmentId: uuid("appointment_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	patientNotes: text("patient_notes"),
}, (table) => [
	index("patient_schedule_requests_external_ref_idx").using("btree", table.externalRef.asc().nullsLast().op("text_ops")),
	index("patient_schedule_requests_patient_idx").using("btree", table.patientId.asc().nullsLast().op("uuid_ops")),
	index("patient_schedule_requests_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [users.id],
			name: "patient_schedule_requests_patient_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "patient_schedule_requests_doctor_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [appointments.id],
			name: "patient_schedule_requests_appointment_id_appointments_id_fk"
		}).onDelete("set null"),
]);

export const monthlyReports = pgTable("monthly_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	monthStart: date("month_start").notNull(),
	payloadJson: jsonb("payload_json"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "monthly_reports_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const priorityReminders = pgTable("priority_reminders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	priority: reminderPriority().default('medium').notNull(),
	sortOrder: integer("sort_order").notNull(),
	completed: boolean().default(false).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("priority_reminders_user_sort_uidx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.sortOrder.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "priority_reminders_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const scheduleEvents = pgTable("schedule_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	eventDate: date("event_date").notNull(),
	eventTime: varchar("event_time", { length: 5 }),
	title: text().notNull(),
	eventKind: varchar("event_kind", { length: 32 }).default('general').notNull(),
	completed: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "schedule_events_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const questionnaireAnswers = pgTable("questionnaire_answers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	questionId: varchar("question_id", { length: 64 }).notNull(),
	answer: jsonb().notNull(),
	questionnaireVersion: integer("questionnaire_version").default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "questionnaire_answers_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const skinDnaCards = pgTable("skin_dna_cards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	skinType: varchar("skin_type", { length: 64 }),
	primaryConcern: text("primary_concern"),
	sensitivityIndex: integer("sensitivity_index"),
	uvSensitivity: varchar("uv_sensitivity", { length: 32 }),
	hormonalCorrelation: varchar("hormonal_correlation", { length: 32 }),
	revision: integer().default(1).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("skin_dna_cards_user_id_uidx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "skin_dna_cards_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const skinScans = pgTable("skin_scans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	originalImageUrl: text("original_image_url").notNull(),
	annotatedImageUrl: text("annotated_image_url").notNull(),
	skinScore: integer("skin_score").notNull(),
	analysisResults: jsonb("analysis_results").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "skin_scans_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const visitNotes = pgTable("visit_notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	visitDate: date("visit_date").notNull(),
	doctorName: varchar("doctor_name", { length: 255 }).notNull(),
	notes: text().notNull(),
	purpose: text(),
	treatments: text(),
	preAdvice: text("pre_advice"),
	postAdvice: text("post_advice"),
	prescription: text(),
	responseRating: visitResponseRating("response_rating"),
	beforeImageIds: jsonb("before_image_ids"),
	afterImageIds: jsonb("after_image_ids"),
	attachments: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "visit_notes_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const scans = pgTable("scans", {
	id: serial().primaryKey().notNull(),
	scanName: varchar("scan_name", { length: 255 }),
	userId: uuid("user_id").notNull(),
	imageUrl: text("image_url").notNull(),
	faceCaptureImages: jsonb("face_capture_images"),
	overallScore: integer("overall_score").notNull(),
	acne: integer().notNull(),
	pigmentation: integer().notNull(),
	wrinkles: integer().notNull(),
	hydration: integer().notNull(),
	texture: integer().notNull(),
	aiSummary: text("ai_summary"),
	scores: jsonb(),
	annotations: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "scans_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phoneCountryCode: varchar("phone_country_code", { length: 8 }).default('+91').notNull(),
	phone: varchar({ length: 32 }),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	role: userRole().default('patient').notNull(),
	age: integer(),
	gender: varchar({ length: 24 }),
	skinType: varchar("skin_type", { length: 100 }),
	primaryGoal: varchar("primary_goal", { length: 255 }),
	appointmentReminderHoursBefore: integer("appointment_reminder_hours_before").default(24).notNull(),
	expoPushToken: text("expo_push_token"),
	timezone: varchar({ length: 64 }).default('Asia/Kolkata').notNull(),
	routineRemindersEnabled: boolean("routine_reminders_enabled").default(true).notNull(),
	routineAmReminderHm: varchar("routine_am_reminder_hm", { length: 5 }).default('08:30').notNull(),
	routinePmReminderHm: varchar("routine_pm_reminder_hm", { length: 5 }).default('22:00').notNull(),
	routineAmReminderLastSentYmd: varchar("routine_am_reminder_last_sent_ymd", { length: 10 }),
	routinePmReminderLastSentYmd: varchar("routine_pm_reminder_last_sent_ymd", { length: 10 }),
	onboardingComplete: boolean("onboarding_complete").default(true).notNull(),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	routinePlanAmItems: jsonb("routine_plan_am_items"),
	routinePlanPmItems: jsonb("routine_plan_pm_items"),
	routinePlanClinicianLocked: boolean("routine_plan_clinician_locked").default(false).notNull(),
	primaryConcern: varchar("primary_concern", { length: 64 }),
	concernSeverity: varchar("concern_severity", { length: 32 }),
	concernDuration: varchar("concern_duration", { length: 32 }),
	triggers: jsonb(),
	priorTreatment: varchar("prior_treatment", { length: 8 }),
	treatmentHistoryText: text("treatment_history_text"),
	treatmentHistoryDuration: varchar("treatment_history_duration", { length: 32 }),
	skinSensitivity: varchar("skin_sensitivity", { length: 32 }),
	baselineSleep: varchar("baseline_sleep", { length: 32 }),
	baselineHydration: varchar("baseline_hydration", { length: 32 }),
	baselineDietType: varchar("baseline_diet_type", { length: 32 }),
	baselineSunExposure: varchar("baseline_sun_exposure", { length: 32 }),
	fitzpatrick: varchar({ length: 8 }),
	streakCurrent: integer("streak_current").default(0).notNull(),
	streakLongest: integer("streak_longest").default(0).notNull(),
	streakLastDate: date("streak_last_date"),
	cycleTrackingEnabled: boolean("cycle_tracking_enabled").default(false).notNull(),
	doctorFeedbackViewedAt: timestamp("doctor_feedback_viewed_at", { withTimezone: true, mode: 'string' }),
	doctorFeedbackNote: text("doctor_feedback_note"),
	doctorFeedbackUpdatedAt: timestamp("doctor_feedback_updated_at", { withTimezone: true, mode: 'string' }),
	doctorFeedbackScanVoiceViewedAt: timestamp("doctor_feedback_scan_voice_viewed_at", { withTimezone: true, mode: 'string' }),
	scheduleCrmDigestAt: timestamp("schedule_crm_digest_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profilePhotoUrl: text("profile_photo_url"),
	clinicVisitedAt: timestamp("clinic_visited_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const routinePlanRevisions = pgTable("routine_plan_revisions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	effectiveFrom: date("effective_from").notNull(),
	amItems: jsonb("am_items").notNull(),
	pmItems: jsonb("pm_items").notNull(),
	createdByStaffId: uuid("created_by_staff_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("routine_plan_revisions_user_effective_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.effectiveFrom.desc().nullsLast()),
	uniqueIndex("routine_plan_revisions_user_effective_uidx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.effectiveFrom.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "routine_plan_revisions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [users.id],
			name: "routine_plan_revisions_created_by_staff_id_users_id_fk"
		}).onDelete("set null"),
]);

export const appointmentRequests = pgTable("appointment_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientId: uuid("patient_id").notNull(),
	doctorId: uuid("doctor_id").notNull(),
	doctorSlotId: uuid("doctor_slot_id").notNull(),
	issue: text().notNull(),
	why: text(),
	status: appointmentRequestStatus().default('pending').notNull(),
	appointmentId: uuid("appointment_id"),
	cancelledReason: text("cancelled_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("appointment_requests_patient_doctor_slot_uidx").using("btree", table.patientId.asc().nullsLast().op("uuid_ops"), table.doctorId.asc().nullsLast().op("uuid_ops"), table.doctorSlotId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [users.id],
			name: "appointment_requests_patient_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "appointment_requests_doctor_id_users_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.doctorSlotId],
			foreignColumns: [doctorSlots.id],
			name: "appointment_requests_doctor_slot_id_doctor_slots_id_fk"
		}).onDelete("restrict"),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	threadId: uuid("thread_id").notNull(),
	sender: chatSender().notNull(),
	text: text().notNull(),
	isUrgent: boolean("is_urgent").default(false).notNull(),
	attachmentUrl: text("attachment_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [chatThreads.id],
			name: "chat_messages_thread_id_chat_threads_id_fk"
		}).onDelete("cascade"),
]);

export const weeklyReports = pgTable("weekly_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	weekStart: date("week_start").notNull(),
	kaiScore: integer("kai_score"),
	weeklyDelta: integer("weekly_delta"),
	consistencyScore: integer("consistency_score"),
	causesJson: jsonb("causes_json"),
	focusActionsJson: jsonb("focus_actions_json"),
	resourcesJson: jsonb("resources_json"),
	narrativeText: text("narrative_text"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "weekly_reports_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const doctorProfileImages = pgTable("doctor_profile_images", {
	ownerUserId: uuid("owner_user_id").primaryKey().notNull(),
	imageUrl: text("image_url"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "doctor_profile_images_owner_user_id_fkey"
		}).onDelete("cascade"),
]);
