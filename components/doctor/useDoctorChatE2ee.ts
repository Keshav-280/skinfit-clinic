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
  const sessionRef = useRef<DoctorThreadE2eeSession | null>(null);
  const bootedPatientRef = useRef<string | null>(null);

  sessionRef.current = session;

  useEffect(() => {
    bootedPatientRef.current = null;
    setSession(null);
    setStatus(null);
    sessionRef.current = null;
  }, [patientId]);

  useEffect(() => {
    if (!enabled || !patientId) return;
    if (bootedPatientRef.current === patientId && sessionRef.current?.ready) {
      return;
    }

    let cancelled = false;

    const boot = async (attempt: number) => {
      const s = await setupDoctorPatientE2ee({
        patientId,
        credentials: "include",
      });
      if (cancelled) return;
      if (!s?.ready && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200));
        if (!cancelled) await boot(attempt + 1);
        return;
      }
      bootedPatientRef.current = patientId;
      sessionRef.current = s;
      setSession(s);
      setStatus(s?.status ?? null);
    };

    void boot(0);

    return () => {
      cancelled = true;
    };
  }, [patientId, enabled]);

  /** Stable decrypt — does not change identity when session loads (avoids chat reload flicker). */
  const decryptMessagesStable = useCallback(
    async <T extends ChatMessageRow>(messages: T[]) => {
      return decryptMessages(messages, sessionRef.current);
    },
    []
  );

  const encrypt = useCallback(
    async (plaintext: string) =>
      encryptOutgoingText(plaintext, sessionRef.current),
    []
  );

  const retrySetup = useCallback(async () => {
    if (!patientId) return;
    bootedPatientRef.current = null;
    const s = await setupDoctorPatientE2ee({
      patientId,
      credentials: "include",
    });
    bootedPatientRef.current = patientId;
    sessionRef.current = s;
    setSession(s);
    setStatus(s?.status ?? null);
  }, [patientId]);

  return {
    session,
    e2eeReady: Boolean(session?.ready),
    e2eeStatus: status,
    decryptMessages: decryptMessagesStable,
    encryptOutgoingText: encrypt,
    retryE2eeSetup: retrySetup,
  };
}
