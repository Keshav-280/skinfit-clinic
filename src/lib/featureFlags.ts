/** kAI, the AI skin companion, is the patient chat. Doctor chat is retired; Clinic Support stays as a button. */
export const AI_CHATBOT_ENABLED = true;

export type PatientChatAssistantId = "ai" | "doctor" | "support";

export const DEFAULT_PATIENT_CHAT_ASSISTANT: PatientChatAssistantId =
  AI_CHATBOT_ENABLED ? "ai" : "support";
