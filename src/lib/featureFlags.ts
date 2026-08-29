/** Set true to show SkinFit AI Assistant in patient chat (web). */
export const AI_CHATBOT_ENABLED = false;

export type PatientChatAssistantId = "ai" | "doctor" | "support";

export const DEFAULT_PATIENT_CHAT_ASSISTANT: PatientChatAssistantId =
  AI_CHATBOT_ENABLED ? "ai" : "support";
