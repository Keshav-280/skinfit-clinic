"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  doctorBtnPrimaryClass,
  doctorNavyIconChipClass,
  doctorPatientPageCardClass,
  doctorPatientPageFormInputClass,
} from "@/components/doctor/DoctorUiPrimitives";
import { localCalendarYmd } from "@/src/lib/date-only";

type CareKind = "pre_treatment" | "post_treatment";

type CareEvent = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  title: string;
  eventKind: CareKind | string;
};

type Draft = {
  dateYmd: string;
  timeHm: string;
  title: string;
};

type Variant = "portal" | "simple";

function emptyDraft(): Draft {
  return { dateYmd: localCalendarYmd(), timeHm: "", title: "" };
}

export function DoctorPatientCareSchedulePanel({
  patientId,
  variant = "portal",
}: {
  patientId: string;
  variant?: Variant;
}) {
  const [items, setItems] = useState<CareEvent[]>([]);
  const [pre, setPre] = useState<Draft>(emptyDraft);
  const [post, setPost] = useState<Draft>(emptyDraft);
  const [preBusy, setPreBusy] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/doctor/patients/${patientId}/schedule-events`,
      { credentials: "include", cache: "no-store" }
    );
    const data = (await res.json()) as { ok?: boolean; items?: CareEvent[] };
    if (res.ok && data.ok) setItems(data.items ?? []);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(kind: CareKind, draft: Draft) {
    setError(null);
    const setBusy = kind === "pre_treatment" ? setPreBusy : setPostBusy;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        eventDateYmd: draft.dateYmd.trim(),
        title: draft.title.trim(),
        eventKind: kind,
      };
      if (draft.timeHm.trim()) body.eventTimeHm = draft.timeHm.trim();

      const res = await fetch(
        `/api/doctor/patients/${patientId}/schedule-events`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "INVALID_TITLE") {
          setError("Enter a note for this reminder.");
        } else if (data.error === "INVALID_DATE") {
          setError("Choose a valid date.");
        } else {
          setError("Could not add this to the patient’s calendar.");
        }
        return;
      }
      if (kind === "pre_treatment") {
        setPre((cur) => ({ ...cur, title: "", timeHm: "" }));
      } else {
        setPost((cur) => ({ ...cur, title: "", timeHm: "" }));
      }
      await load();
    } catch {
      setError("Could not add this to the patient’s calendar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(
      `/api/doctor/patients/${patientId}/schedule-events/${id}`,
      { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) {
      setError("Could not remove reminder.");
      return;
    }
    await load();
  }

  const forms = (
    <div className="grid gap-3 sm:grid-cols-2">
      <CareForm
        heading="Pre-treatment"
        placeholder="e.g. Stop retinol tonight"
        draft={pre}
        setDraft={setPre}
        busy={preBusy}
        onAdd={() => void add("pre_treatment", pre)}
      />
      <CareForm
        heading="Post-treatment"
        placeholder="e.g. Hydrafacial aftercare"
        draft={post}
        setDraft={setPost}
        busy={postBusy}
        onAdd={() => void add("post_treatment", post)}
      />
    </div>
  );

  const list =
    items.length === 0 ? (
      <p className="mt-4 text-[12px] text-[#1E1B31]/50">
        Nothing on the patient’s calendar yet.
      </p>
    ) : (
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const isPre = item.eventKind === "pre_treatment";
          return (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[#1E1B31]/10 bg-[#FAFBFD] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isPre
                        ? "bg-[#1E1B31]/10 text-[#1E1B31]"
                        : "bg-[#7c3aed]/12 text-[#5b21b6]"
                    }`}
                  >
                    {isPre ? "Pre" : "Post"}
                  </span>
                  <p className="text-sm font-semibold text-[#1E1B31]">
                    {item.title}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] text-[#1E1B31]/50">
                  {format(
                    parseISO(`${item.eventDateYmd}T12:00:00`),
                    "d MMM yyyy"
                  )}
                  {item.eventTimeHm ? ` · ${item.eventTimeHm}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                className="rounded-md p-1.5 text-[#1E1B31]/45 hover:bg-white hover:text-rose-600"
                title="Remove from calendar"
                aria-label="Remove from calendar"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    );

  if (variant === "simple") {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
          Pre & post treatment
        </h2>
        <p className="mt-1 text-[12px] text-[#1E1B31]/50">
          Add a reminder and it appears on this patient’s calendar.
        </p>
        <div className="mt-3">{forms}</div>
        {error ? (
          <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
        ) : null}
        {list}
      </section>
    );
  }

  return (
    <div className={`${doctorPatientPageCardClass} mt-4 p-4`}>
      <h2 className="mb-3 flex items-center gap-2 border-b border-[#1E1B31]/15 pb-3 text-[#1E1B31]">
        <span className={`h-8 w-8 rounded-lg ${doctorNavyIconChipClass}`}>
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Pre & post treatment</span>
      </h2>
      <p className="mb-3 text-[11px] leading-snug text-[#1E1B31]/55">
        These go onto the patient’s calendar under Your schedule.
      </p>
      {forms}
      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
      ) : null}
      {list}
    </div>
  );
}

function CareForm({
  heading,
  placeholder,
  draft,
  setDraft,
  busy,
  onAdd,
}: {
  heading: string;
  placeholder: string;
  draft: Draft;
  setDraft: (next: Draft) => void;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#1E1B31]/10 bg-[#FAF8F5] p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#1E1B31]">
        {heading}
      </p>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
          Date
        </span>
        <input
          type="date"
          value={draft.dateYmd}
          onChange={(e) => setDraft({ ...draft, dateYmd: e.target.value })}
          className={`${doctorPatientPageFormInputClass} py-1.5`}
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
          Time (optional)
        </span>
        <input
          type="time"
          value={draft.timeHm}
          onChange={(e) => setDraft({ ...draft, timeHm: e.target.value })}
          className={`${doctorPatientPageFormInputClass} py-1.5 tabular-nums`}
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
          Note
        </span>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder={placeholder}
          className={`${doctorPatientPageFormInputClass} py-1.5`}
        />
      </label>
      <button
        type="button"
        disabled={busy || !draft.dateYmd.trim() || !draft.title.trim()}
        onClick={onAdd}
        className={`${doctorBtnPrimaryClass} mt-3 w-full px-3 py-1.5 text-xs disabled:opacity-50`}
      >
        {busy ? "Adding…" : `Add ${heading.toLowerCase()}`}
      </button>
    </div>
  );
}
