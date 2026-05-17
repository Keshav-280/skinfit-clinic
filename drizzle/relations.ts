import { relations } from "drizzle-orm/relations";
import { users, doctorSlots, chatThreads, dailyFocus, dailyLogs, doctorSosAcknowledgements, chatMessages, appointments, doctorFeedbackVoiceNotes, scans, parameterScores, patientScheduleRequests, monthlyReports, priorityReminders, scheduleEvents, questionnaireAnswers, skinDnaCards, skinScans, visitNotes, appointmentRequests, weeklyReports, doctorProfileImages } from "./schema";

export const doctorSlotsRelations = relations(doctorSlots, ({one, many}) => ({
	user: one(users, {
		fields: [doctorSlots.doctorId],
		references: [users.id]
	}),
	appointmentRequests: many(appointmentRequests),
}));

export const usersRelations = relations(users, ({many}) => ({
	doctorSlots: many(doctorSlots),
	chatThreads: many(chatThreads),
	dailyFoci: many(dailyFocus),
	dailyLogs: many(dailyLogs),
	doctorSosAcknowledgements: many(doctorSosAcknowledgements),
	appointments_userId: many(appointments, {
		relationName: "appointments_userId_users_id"
	}),
	appointments_doctorId: many(appointments, {
		relationName: "appointments_doctorId_users_id"
	}),
	doctorFeedbackVoiceNotes_userId: many(doctorFeedbackVoiceNotes, {
		relationName: "doctorFeedbackVoiceNotes_userId_users_id"
	}),
	doctorFeedbackVoiceNotes_doctorId: many(doctorFeedbackVoiceNotes, {
		relationName: "doctorFeedbackVoiceNotes_doctorId_users_id"
	}),
	patientScheduleRequests_patientId: many(patientScheduleRequests, {
		relationName: "patientScheduleRequests_patientId_users_id"
	}),
	patientScheduleRequests_doctorId: many(patientScheduleRequests, {
		relationName: "patientScheduleRequests_doctorId_users_id"
	}),
	monthlyReports: many(monthlyReports),
	priorityReminders: many(priorityReminders),
	scheduleEvents: many(scheduleEvents),
	questionnaireAnswers: many(questionnaireAnswers),
	skinDnaCards: many(skinDnaCards),
	skinScans: many(skinScans),
	visitNotes: many(visitNotes),
	scans: many(scans),
	appointmentRequests_patientId: many(appointmentRequests, {
		relationName: "appointmentRequests_patientId_users_id"
	}),
	appointmentRequests_doctorId: many(appointmentRequests, {
		relationName: "appointmentRequests_doctorId_users_id"
	}),
	weeklyReports: many(weeklyReports),
	doctorProfileImages: many(doctorProfileImages),
}));

export const chatThreadsRelations = relations(chatThreads, ({one, many}) => ({
	user: one(users, {
		fields: [chatThreads.userId],
		references: [users.id]
	}),
	chatMessages: many(chatMessages),
}));

export const dailyFocusRelations = relations(dailyFocus, ({one}) => ({
	user: one(users, {
		fields: [dailyFocus.userId],
		references: [users.id]
	}),
}));

export const dailyLogsRelations = relations(dailyLogs, ({one}) => ({
	user: one(users, {
		fields: [dailyLogs.userId],
		references: [users.id]
	}),
}));

export const doctorSosAcknowledgementsRelations = relations(doctorSosAcknowledgements, ({one}) => ({
	user: one(users, {
		fields: [doctorSosAcknowledgements.staffUserId],
		references: [users.id]
	}),
	chatMessage: one(chatMessages, {
		fields: [doctorSosAcknowledgements.chatMessageId],
		references: [chatMessages.id]
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({one, many}) => ({
	doctorSosAcknowledgements: many(doctorSosAcknowledgements),
	chatThread: one(chatThreads, {
		fields: [chatMessages.threadId],
		references: [chatThreads.id]
	}),
}));

export const appointmentsRelations = relations(appointments, ({one, many}) => ({
	user_userId: one(users, {
		fields: [appointments.userId],
		references: [users.id],
		relationName: "appointments_userId_users_id"
	}),
	user_doctorId: one(users, {
		fields: [appointments.doctorId],
		references: [users.id],
		relationName: "appointments_doctorId_users_id"
	}),
	patientScheduleRequests: many(patientScheduleRequests),
}));

export const doctorFeedbackVoiceNotesRelations = relations(doctorFeedbackVoiceNotes, ({one}) => ({
	user_userId: one(users, {
		fields: [doctorFeedbackVoiceNotes.userId],
		references: [users.id],
		relationName: "doctorFeedbackVoiceNotes_userId_users_id"
	}),
	user_doctorId: one(users, {
		fields: [doctorFeedbackVoiceNotes.doctorId],
		references: [users.id],
		relationName: "doctorFeedbackVoiceNotes_doctorId_users_id"
	}),
	scan: one(scans, {
		fields: [doctorFeedbackVoiceNotes.scanId],
		references: [scans.id]
	}),
}));

export const scansRelations = relations(scans, ({one, many}) => ({
	doctorFeedbackVoiceNotes: many(doctorFeedbackVoiceNotes),
	parameterScores: many(parameterScores),
	user: one(users, {
		fields: [scans.userId],
		references: [users.id]
	}),
}));

export const parameterScoresRelations = relations(parameterScores, ({one}) => ({
	scan: one(scans, {
		fields: [parameterScores.scanId],
		references: [scans.id]
	}),
}));

export const patientScheduleRequestsRelations = relations(patientScheduleRequests, ({one}) => ({
	user_patientId: one(users, {
		fields: [patientScheduleRequests.patientId],
		references: [users.id],
		relationName: "patientScheduleRequests_patientId_users_id"
	}),
	user_doctorId: one(users, {
		fields: [patientScheduleRequests.doctorId],
		references: [users.id],
		relationName: "patientScheduleRequests_doctorId_users_id"
	}),
	appointment: one(appointments, {
		fields: [patientScheduleRequests.appointmentId],
		references: [appointments.id]
	}),
}));

export const monthlyReportsRelations = relations(monthlyReports, ({one}) => ({
	user: one(users, {
		fields: [monthlyReports.userId],
		references: [users.id]
	}),
}));

export const priorityRemindersRelations = relations(priorityReminders, ({one}) => ({
	user: one(users, {
		fields: [priorityReminders.userId],
		references: [users.id]
	}),
}));

export const scheduleEventsRelations = relations(scheduleEvents, ({one}) => ({
	user: one(users, {
		fields: [scheduleEvents.userId],
		references: [users.id]
	}),
}));

export const questionnaireAnswersRelations = relations(questionnaireAnswers, ({one}) => ({
	user: one(users, {
		fields: [questionnaireAnswers.userId],
		references: [users.id]
	}),
}));

export const skinDnaCardsRelations = relations(skinDnaCards, ({one}) => ({
	user: one(users, {
		fields: [skinDnaCards.userId],
		references: [users.id]
	}),
}));

export const skinScansRelations = relations(skinScans, ({one}) => ({
	user: one(users, {
		fields: [skinScans.userId],
		references: [users.id]
	}),
}));

export const visitNotesRelations = relations(visitNotes, ({one}) => ({
	user: one(users, {
		fields: [visitNotes.userId],
		references: [users.id]
	}),
}));

export const appointmentRequestsRelations = relations(appointmentRequests, ({one}) => ({
	user_patientId: one(users, {
		fields: [appointmentRequests.patientId],
		references: [users.id],
		relationName: "appointmentRequests_patientId_users_id"
	}),
	user_doctorId: one(users, {
		fields: [appointmentRequests.doctorId],
		references: [users.id],
		relationName: "appointmentRequests_doctorId_users_id"
	}),
	doctorSlot: one(doctorSlots, {
		fields: [appointmentRequests.doctorSlotId],
		references: [doctorSlots.id]
	}),
}));

export const weeklyReportsRelations = relations(weeklyReports, ({one}) => ({
	user: one(users, {
		fields: [weeklyReports.userId],
		references: [users.id]
	}),
}));

export const doctorProfileImagesRelations = relations(doctorProfileImages, ({one}) => ({
	user: one(users, {
		fields: [doctorProfileImages.ownerUserId],
		references: [users.id]
	}),
}));