import AsyncStorage from "@react-native-async-storage/async-storage";

/** Same keys as web `clinicSupportInboxClient` so counts match if user switches clients. */
export const CLINIC_SUPPORT_INBOX_LAST_SEEN_KEY = "skinfit.clinicSupportLastSeenAt";
export const DOCTOR_CHAT_INBOX_LAST_SEEN_KEY = "skinfit.doctorChatLastSeenAt";

const EPOCH_ISO = new Date(0).toISOString();

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeInboxReadCursors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyInboxReadCursors(): void {
  for (const l of listeners) l();
}

export async function getClinicSupportInboxLastSeenIso(): Promise<string> {
  const v = await AsyncStorage.getItem(CLINIC_SUPPORT_INBOX_LAST_SEEN_KEY);
  return v ?? EPOCH_ISO;
}

export async function getDoctorInboxLastSeenIso(): Promise<string> {
  const v = await AsyncStorage.getItem(DOCTOR_CHAT_INBOX_LAST_SEEN_KEY);
  return v ?? EPOCH_ISO;
}

/** Advance read cursor so `/api/chat/inbox/unread` stops counting older clinic messages. */
export async function markClinicSupportInboxSeenFromServer(iso?: string | null): Promise<void> {
  const now = Date.now();
  const from = iso ? Date.parse(iso) : NaN;
  const ms = Math.max(Number.isNaN(from) ? 0 : from, now);
  await AsyncStorage.setItem(
    CLINIC_SUPPORT_INBOX_LAST_SEEN_KEY,
    new Date(ms).toISOString()
  );
  notifyInboxReadCursors();
}

export async function markDoctorInboxSeenFromServer(iso?: string | null): Promise<void> {
  const now = Date.now();
  const from = iso ? Date.parse(iso) : NaN;
  const ms = Math.max(Number.isNaN(from) ? 0 : from, now);
  await AsyncStorage.setItem(DOCTOR_CHAT_INBOX_LAST_SEEN_KEY, new Date(ms).toISOString());
  notifyInboxReadCursors();
}
