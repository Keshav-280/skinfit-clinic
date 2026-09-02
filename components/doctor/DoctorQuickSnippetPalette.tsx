"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { DoctorSnippetGroup } from "@/src/lib/doctorQuickSnippets";
import { writeDoctorSnippetToDataTransfer } from "@/src/lib/doctorQuickSnippets";
import { useDoctorCustomSnippets } from "@/components/doctor/useDoctorCustomSnippets";
import { useDoctorSnippetGroups } from "@/components/doctor/useDoctorSnippetGroups";
import { doctorFormInputSmClass } from "@/src/lib/doctorPortalTheme";
import type { DoctorCustomSnippetScope } from "@/src/lib/doctorCustomSnippets";

type DoctorQuickSnippetPaletteProps = {
  groups: DoctorSnippetGroup[];
  onInsert?: (text: string) => void;
  hint?: string;
  className?: string;
  allowCustomPhrases?: boolean;
  customPhraseScope?: DoctorCustomSnippetScope;
};

function SnippetChip({
  item,
  onInsert,
  onRemove,
}: {
  item: string;
  onInsert?: (text: string) => void;
  onRemove?: () => void;
}) {
  return (
    <span className="group/chip inline-flex max-w-full items-center">
      <button
        type="button"
        draggable
        title={item}
        onDragStart={(e) => {
          writeDoctorSnippetToDataTransfer(e.dataTransfer, item);
        }}
        onClick={() => onInsert?.(item)}
        className="max-w-full cursor-grab truncate rounded-full bg-[#EEF1F8] px-2.5 py-1 text-left text-[11px] font-medium text-[#1E1B31] transition hover:bg-[#E2E8F4] active:cursor-grabbing"
      >
        {item}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="-ml-1 rounded-full p-0.5 text-[#1E1B31]/40 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/chip:opacity-100"
          aria-label={`Remove ${item}`}
          title="Remove"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

function PhraseAddRow({
  draft,
  onDraftChange,
  onSubmit,
  placeholder = "Add phrase…",
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-1.5">
      <input
        type="text"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className={`${doctorFormInputSmClass} min-w-0 flex-1`}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!draft.trim()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1E1B31] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#242A5F] disabled:opacity-40"
      >
        <Plus className="h-3 w-3" aria-hidden />
        Add
      </button>
    </div>
  );
}

export function DoctorQuickSnippetPalette({
  groups,
  onInsert,
  hint = "Drag onto a field or click to insert",
  className = "",
  allowCustomPhrases = true,
  customPhraseScope = "routine",
}: DoctorQuickSnippetPaletteProps) {
  const { items: customPhrases, add, remove } = useDoctorCustomSnippets(customPhraseScope);
  const { groupItems, addToGroup, removeFromGroup } = useDoctorSnippetGroups(
    customPhraseScope,
    groups
  );
  const [open, setOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState("");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});

  const builtInCount = groups.reduce((n, g) => n + g.items.length, 0);
  const tabs = useMemo(() => {
    const builtIn = groups.map((g) => ({
      id: g.label,
      label: g.label,
      items: groupItems[g.label] ?? [...g.items],
      custom: false,
    }));
    if (allowCustomPhrases) {
      builtIn.push({
        id: "__saved__",
        label: "Saved",
        items: customPhrases,
        custom: true,
      });
    }
    return builtIn;
  }, [groups, allowCustomPhrases, customPhrases, groupItems]);

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? "");
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeGroupDraft = activeTab && !activeTab.custom ? groupDrafts[activeTab.id] ?? "" : "";

  if (builtInCount === 0 && (!allowCustomPhrases || customPhrases.length === 0)) {
    return null;
  }

  function submitCustomPhrase() {
    const text = savedDraft.trim();
    if (!text) return;
    add(text);
    setSavedDraft("");
    setActiveTabId("__saved__");
    setOpen(true);
  }

  function submitGroupPhrase() {
    if (!activeTab || activeTab.custom) return;
    const text = activeGroupDraft.trim();
    if (!text) return;
    addToGroup(activeTab.label, text);
    setGroupDrafts((prev) => ({ ...prev, [activeTab.id]: "" }));
    setOpen(true);
  }

  const visibleCount = tabs
    .filter((t) => !t.custom)
    .reduce((n, t) => n + t.items.length, 0);
  const summary =
    visibleCount > 0
      ? `${visibleCount} phrase${visibleCount === 1 ? "" : "s"}`
      : customPhrases.length > 0
        ? `${customPhrases.length} saved`
        : "Browse phrases";

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#1E1B31]/10 bg-white/90 shadow-[0_1px_3px_rgba(30, 27, 49,0.06)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[#F8F9FC]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1E1B31]">Quick phrases</p>
          <p className="truncate text-[10px] text-[#1E1B31]/50">
            {open ? "Click to collapse" : summary}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#1E1B31]/45 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-[#1E1B31]/8 px-2 pb-2 pt-1.5">
          {tabs.length > 1 ? (
            <div
              className="mb-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab?.id === tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                    activeTab?.id === tab.id
                      ? "bg-[#1E1B31] text-white"
                      : "bg-[#F1F4FA] text-[#1E1B31]/70 hover:bg-[#E8EDF6]"
                  }`}
                >
                  {tab.label}
                  {tab.custom && customPhrases.length > 0 ? (
                    <span className="ml-1 opacity-80">({customPhrases.length})</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {activeTab?.custom ? (
            <div className="space-y-2">
              {customPhrases.length > 0 ? (
                <div className="flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                  {customPhrases.map((item) => (
                    <SnippetChip
                      key={`custom-${item}`}
                      item={item}
                      onInsert={onInsert}
                      onRemove={() => remove(item)}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-1 py-2 text-[11px] text-[#1E1B31]/45">
                  Save phrases you use often - they appear here.
                </p>
              )}
              <PhraseAddRow
                draft={savedDraft}
                onDraftChange={setSavedDraft}
                onSubmit={submitCustomPhrase}
                placeholder="New phrase…"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex max-h-[5.5rem] flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
                {(activeTab?.items ?? []).length > 0 ? (
                  (activeTab?.items ?? []).map((item) => (
                    <SnippetChip
                      key={`${activeTab?.id}-${item}`}
                      item={item}
                      onInsert={onInsert}
                      onRemove={() => removeFromGroup(activeTab!.label, item)}
                    />
                  ))
                ) : (
                  <p className="px-1 py-2 text-[11px] text-[#1E1B31]/45">
                    No phrases in this list - add one below.
                  </p>
                )}
              </div>
              <PhraseAddRow
                draft={activeGroupDraft}
                onDraftChange={(value) => {
                  if (!activeTab) return;
                  setGroupDrafts((prev) => ({ ...prev, [activeTab.id]: value }));
                }}
                onSubmit={submitGroupPhrase}
                placeholder="Add phrase to this list…"
              />
            </div>
          )}

          {hint ? (
            <p className="mt-2 border-t border-[#1E1B31]/6 pt-1.5 text-[10px] leading-snug text-[#1E1B31]/45">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
