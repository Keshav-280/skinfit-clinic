"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decryptMessages,
  encryptOutgoingText,
  setupDoctorPatientE2ee,
  type ChatMessageRow,
  type DoctorThreadE2eeSession,
} from "@/src/lib/chatE2ee/client";

export function useDoctorChatE2ee(patientId: string, enabled: boolean) {
  const [session, setSession] = useState<DoctorThreadE2eeSession | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const bootedPatientRef = useRef<string | null>(null);

  useEffect(() => {
    bootedPatientRef.current = null;
    setSession(null);
    setStatus(null);
  }, [patientId]);

  useEffect(() => {
    if (!enabled || !patientId) return;
    if (bootedPatientRef.current === patientId) return;
    let cancelled = false;
    void (async () => {
      const s = await setupDoctorPatientE2ee({ patientId, credentials: "include" });
      if (cancelled) return;
      bootedPatientRef.current = patientId;
      setSession(s);
      setStatus(s?.status ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, enabled]);

  const decrypt = useCallback(
    async <T extends ChatMessageRow>(messages: T[]) => {
      return decryptMessages(messages, session);
    },
    [session]
  );

  const encrypt = useCallback(
    async (plaintext: string) => encryptOutgoingText(plaintext, session),
    [session]
  );

  return {
    session,
    e2eeReady: Boolean(session?.ready),
    e2eeStatus: status,
    decryptMessages: decrypt,
    encryptOutgoingText: encrypt,
  };
}
