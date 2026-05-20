"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import type { DoctorPatientDetailSection } from "@/src/lib/doctorPatientDetailApi";

export type DoctorPatientDetailJson = {
  success?: boolean;
  calendarTodayYmd?: string;
  patient?: Record<string, unknown> & {
    id: string;
    name: string;
    email: string;
  };
  scans?: unknown[];
  parameterScoresByScanId?: Record<string, unknown[]>;
  visits?: unknown[];
  recentVoiceNotes?: unknown[];
  dailyLogs?: unknown[];
  questionnaireAnswers?: unknown[];
  skinDnaCard?: unknown;
  legacySkinScans?: unknown[];
  weeklyReports?: unknown[];
  monthlyReports?: unknown[];
  appointments?: unknown[];
  scheduleEvents?: unknown[];
};

type SectionState = Record<DoctorPatientDetailSection, boolean>;

const INITIAL_LOADING: SectionState = {
  profile: true,
  scans: false,
  activity: false,
  schedule: false,
  reports: false,
};

const INITIAL_LOADED: SectionState = {
  profile: false,
  scans: false,
  activity: false,
  schedule: false,
  reports: false,
};

const SECTION_LABEL: Record<DoctorPatientDetailSection, string> = {
  profile: "patient profile",
  scans: "scans",
  activity: "activity",
  schedule: "schedule",
  reports: "reports",
};

function sectionLoadErrorMessage(
  section: DoctorPatientDetailSection,
  res: Response,
  parsed: { error?: string } | null
): string {
  if (parsed?.error) {
    const code = parsed.error;
    if (code === "UNAUTHORIZED") return "Session expired — sign in again.";
    if (code === "NOT_FOUND") return "Patient not found.";
    if (code === "LOAD_FAILED") return `Could not load ${SECTION_LABEL[section]}.`;
  }
  if (res.status === 401) return "Session expired — sign in again.";
  if (res.status === 404) return "Patient not found.";
  if (res.status >= 500) return `Could not load ${SECTION_LABEL[section]} (server error).`;
  return `Could not load ${SECTION_LABEL[section]}.`;
}

async function parsePatientDetailResponse(
  res: Response,
  section?: DoctorPatientDetailSection
): Promise<DoctorPatientDetailJson & { error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      section
        ? sectionLoadErrorMessage(section, res, null)
        : "Could not load patient (empty response)."
    );
  }
  let parsed: (DoctorPatientDetailJson & { error?: string }) | null = null;
  try {
    parsed = JSON.parse(text) as DoctorPatientDetailJson & { error?: string };
  } catch {
    throw new Error(
      section
        ? sectionLoadErrorMessage(section, res, null)
        : "Could not load patient (invalid response)."
    );
  }
  if (!res.ok || !parsed.success) {
    throw new Error(
      section
        ? sectionLoadErrorMessage(section, res, parsed)
        : (parsed.error ?? "Could not load patient.")
    );
  }
  return parsed;
}

async function fetchSection(
  patientId: string,
  section: DoctorPatientDetailSection
): Promise<DoctorPatientDetailJson> {
  const res = await fetch(
    `/api/doctor/patients/${encodeURIComponent(patientId)}?section=${section}`,
    { credentials: "include", cache: "no-store" }
  );
  return parsePatientDetailResponse(res, section);
}

export function useDoctorPatientDetail(patientId: string) {
  const [data, setData] = useState<DoctorPatientDetailJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<SectionState>({ ...INITIAL_LOADING });
  const [loaded, setLoaded] = useState<SectionState>({ ...INITIAL_LOADED });
  const loadedRef = useRef(loaded);
  const attemptedRef = useRef<SectionState>({ ...INITIAL_LOADED });

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const merge = useCallback((patch: DoctorPatientDetailJson) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchPatient = useCallback((patch: Record<string, unknown>) => {
    setData((prev) =>
      prev?.patient
        ? { ...prev, patient: { ...prev.patient, ...patch } }
        : prev
    );
  }, []);

  const resetSectionState = useCallback(() => {
    const fresh = { ...INITIAL_LOADED };
    setLoaded(fresh);
    loadedRef.current = fresh;
    attemptedRef.current = { ...INITIAL_LOADED };
  }, []);

  const loadSection = useCallback(
    async (section: DoctorPatientDetailSection, opts?: { force?: boolean }) => {
      if (
        !opts?.force &&
        (loadedRef.current[section] || attemptedRef.current[section])
      ) {
        return;
      }
      attemptedRef.current = { ...attemptedRef.current, [section]: true };
      setLoading((s) => ({ ...s, [section]: true }));
      if (section === "profile" || opts?.force) {
        setErr(null);
      }
      try {
        const j = await fetchSection(patientId, section);
        merge(j);
        setLoaded((s) => {
          const next = { ...s, [section]: true };
          loadedRef.current = next;
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load patient.";
        if (section === "profile") {
          setErr(msg);
          setData(null);
        } else {
          setErr((prev) => prev ?? msg);
        }
      } finally {
        setLoading((s) => ({ ...s, [section]: false }));
      }
    },
    [patientId, merge]
  );

  const reloadAll = useCallback(async () => {
    resetSectionState();
    setLoading({
      profile: true,
      scans: true,
      activity: true,
      schedule: true,
      reports: true,
    });
    setErr(null);
    try {
      const res = await fetch(
        `/api/doctor/patients/${encodeURIComponent(patientId)}`,
        { credentials: "include", cache: "no-store" }
      );
      const j = await parsePatientDetailResponse(res);
      setData(j);
      const allLoaded: SectionState = {
        profile: true,
        scans: true,
        activity: true,
        schedule: true,
        reports: true,
      };
      setLoaded(allLoaded);
      loadedRef.current = allLoaded;
      attemptedRef.current = allLoaded;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load patient.");
    } finally {
      setLoading({ ...INITIAL_LOADED });
    }
  }, [patientId, resetSectionState]);

  useEffect(() => {
    setData(null);
    setErr(null);
    resetSectionState();
    setLoading({ ...INITIAL_LOADING, profile: true });

    void (async () => {
      await loadSection("profile");
      void loadSection("schedule");
      void loadSection("scans");
      void loadSection("activity");
    })();
  }, [patientId, loadSection, resetSectionState]);

  const ensureSection = useCallback(
    (section: DoctorPatientDetailSection) => {
      if (
        !loadedRef.current[section] &&
        !loading[section] &&
        !attemptedRef.current[section]
      ) {
        void loadSection(section);
      }
    },
    [loadSection, loading]
  );

  useEffect(() => {
    const onRefresh = () => void reloadAll();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
  }, [reloadAll]);

  return {
    data,
    err,
    loading,
    loaded,
    loadSection,
    reloadAll,
    patchPatient,
    ensureSection,
    profileReady: Boolean(data?.patient),
  };
}
