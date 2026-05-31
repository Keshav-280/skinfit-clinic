import { useCallback, useEffect, useRef, useState } from "react";

import { apiJson } from "@/lib/api";
import { emitJournalUpdated, type JournalSyncPatch } from "@/lib/journalSync";

export type TrackerSaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_DEBOUNCE_MS = 400;

type PendingSave = {
  date: string;
  body: Record<string, unknown>;
};

function journalPatchFromBody(
  date: string,
  body: Record<string, unknown>
): JournalSyncPatch {
  const patch: JournalSyncPatch = { date };
  if (typeof body.sleepHours === "number") patch.sleepHours = body.sleepHours;
  if (typeof body.stressLevel === "number") patch.stressLevel = body.stressLevel;
  if (typeof body.waterGlasses === "number") patch.waterGlasses = body.waterGlasses;
  return patch;
}

export function useDebouncedTrackerAutoSave(
  token: string | null,
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<PendingSave | null>(null);
  const [saveStatus, setSaveStatus] = useState<TrackerSaveStatus>("idle");

  const markReady = useCallback(() => {
    readyRef.current = true;
  }, []);

  const markNotReady = useCallback(() => {
    readyRef.current = false;
    setSaveStatus("idle");
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingRef.current = null;
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const pending = pendingRef.current;
    if (!pending || !readyRef.current || !token) return;

    pendingRef.current = null;
    setSaveStatus("saving");

    try {
      await apiJson("/api/journal", token, {
        method: "POST",
        body: JSON.stringify({ date: pending.date, ...pending.body }),
      });
      emitJournalUpdated(journalPatchFromBody(pending.date, pending.body));
      setSaveStatus("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [token]);

  const scheduleSave = useCallback(
    (date: string, body: Record<string, unknown>) => {
      if (!readyRef.current || !token) return;

      const prev = pendingRef.current?.date === date ? pendingRef.current.body : {};
      const merged = { ...prev, ...body };
      pendingRef.current = { date, body: merged };

      emitJournalUpdated(journalPatchFromBody(date, merged));

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");

      saveTimer.current = setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [debounceMs, flushSave, token]
  );

  useEffect(() => {
    return () => {
      void flushSave();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [flushSave]);

  return { saveStatus, scheduleSave, flushSave, markReady, markNotReady };
};
