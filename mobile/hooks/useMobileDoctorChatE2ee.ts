import { useCallback, useEffect, useRef, useState } from "react";

import {
  decryptMessages,
  ensureMobileDoctorChatE2eeReady,
  encryptOutgoingText,
  resetMobileDoctorChatE2eeFresh,
  setupMobileDoctorChatE2ee,
  type ChatMessageRow,
  type DoctorThreadE2eeSession,
} from "@/lib/chatE2ee";
import { isDoctorChatE2eeEnabled } from "@/src/lib/chatDoctorE2eeConfig";

export function useMobileDoctorChatE2ee(token: string | null, enabled: boolean) {
  const [session, setSession] = useState<DoctorThreadE2eeSession | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sessionRef = useRef<DoctorThreadE2eeSession | null>(null);
  const bootedRef = useRef(false);

  sessionRef.current = session;
  const e2eeReady = Boolean(session?.ready);

  useEffect(() => {
    bootedRef.current = false;
    setSession(null);
    setStatus(null);
    sessionRef.current = null;
  }, [token]);

  const featureOn = isDoctorChatE2eeEnabled();

  useEffect(() => {
    if (!enabled || !token) {
      sessionRef.current = null;
      setSession(null);
      setStatus(null);
      return;
    }
    if (!featureOn) {
      const plain: DoctorThreadE2eeSession = {
        threadId: "",
        threadAesKey: null,
        ready: true,
        status: null,
      };
      bootedRef.current = true;
      sessionRef.current = plain;
      setSession(plain);
      setStatus(null);
      return;
    }
    if (bootedRef.current && sessionRef.current?.ready) return;

    let cancelled = false;

    const boot = async () => {
      const s = await ensureMobileDoctorChatE2eeReady(token);
      if (cancelled) return;
      bootedRef.current = true;
      sessionRef.current = s;
      setSession(s);
      setStatus(s?.ready ? null : s?.status ?? null);
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [enabled, token, featureOn]);

  const decryptMessagesStable = useCallback(
    async <T extends ChatMessageRow>(messages: T[]) =>
      decryptMessages(messages, sessionRef.current),
    []
  );

  const encrypt = useCallback(
    async (plaintext: string) => encryptOutgoingText(plaintext, sessionRef.current),
    []
  );

  const retrySetup = useCallback(async () => {
    if (!token) return null;
    bootedRef.current = false;
    const s = await ensureMobileDoctorChatE2eeReady(token, 4);
    bootedRef.current = true;
    sessionRef.current = s;
    setSession(s);
    setStatus(s?.ready ? null : s?.status ?? null);
    return s;
  }, [token]);

  const resetSecureChat = useCallback(async () => {
    if (!token) return null;
    bootedRef.current = false;
    await resetMobileDoctorChatE2eeFresh(token);
    return retrySetup();
  }, [token, retrySetup]);

  const ensureReadyForSend = useCallback(async () => {
    if (sessionRef.current?.ready) return sessionRef.current;
    return retrySetup();
  }, [retrySetup]);

  return {
    session,
    e2eeFeatureEnabled: featureOn,
    e2eeReady: featureOn ? e2eeReady : true,
    e2eeStatus: featureOn ? status : null,
    decryptMessages: decryptMessagesStable,
    encryptOutgoingText: encrypt,
    retryE2eeSetup: retrySetup,
    resetSecureChat,
    ensureReadyForSend,
  };
}
