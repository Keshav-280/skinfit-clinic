"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TrackerSaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_DEBOUNCE_MS = 800;

export function useDebouncedTrackerAutoSave(debounceMs = DEFAULT_DEBOUNCE_MS) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
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
  }, []);

  const scheduleSave = useCallback(
    (date: string, body: Record<string, unknown>) => {
      if (!readyRef.current) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");

      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/journal", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, ...body }),
          });
          if (!res.ok) throw new Error("save failed");
          setSaveStatus("saved");
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        }
      }, debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  return { saveStatus, scheduleSave, markReady, markNotReady };
}
