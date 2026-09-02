"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { TrackerPageSkeleton } from "@/components/dashboard/PageSkeletons";
import { useDebouncedTrackerAutoSave } from "@/src/hooks/useDebouncedTrackerAutoSave";
import { useJournalTrackerDate } from "@/src/hooks/useJournalTrackerDate";

const moods = ["Calm", "Neutral", "Anxious", "Stressed", "Overwhelmed"] as const;

function stressColor(level: number) {
  if (level <= 3) return { bg: "bg-green-100", text: "text-green-700", label: "Low", ring: "ring-green-400" };
  if (level <= 6) return { bg: "bg-amber-100", text: "text-amber-700", label: "Moderate", ring: "ring-amber-400" };
  return { bg: "bg-red-100", text: "text-red-700", label: "High", ring: "ring-red-400" };
}

function stressAccent(level: number) {
  if (level <= 3) return "#16a34a";
  if (level <= 6) return "#d97706";
  return "#dc2626";
}

export default function StressTrackerPage() {
  const journalDate = useJournalTrackerDate();
  const [level, setLevel] = useState(5);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const { saveStatus, scheduleSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave();

  useEffect(() => {
    markNotReady();
    fetch(`/api/journal?date=${encodeURIComponent(journalDate)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) {
          setLevel(data.entry.stressLevel ?? 5);
          setSelectedMood(data.entry.mood ?? null);
          if (typeof data.entry.journalEntry === "string") {
            setNotes(data.entry.journalEntry);
          }
        } else {
          setLevel(5);
          setSelectedMood(null);
          setNotes("");
        }
      })
      .finally(() => {
        setLoading(false);
        markReady();
      });
  }, [journalDate, markNotReady, markReady]);

  function handleSetLevel(newLevel: number) {
    setLevel(newLevel);
    scheduleSave(journalDate, {
      stressLevel: newLevel,
      mood: selectedMood,
    });
  }

  function handleSetMood(mood: string) {
    setSelectedMood(mood);
    scheduleSave(journalDate, { stressLevel: level, mood });
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    scheduleSave(journalDate, {
      stressLevel: level,
      mood: selectedMood,
      journalEntry: value,
    });
  }

  const decrement = () => handleSetLevel(Math.max(0, level - 1));
  const increment = () => handleSetLevel(Math.min(10, level + 1));

  const { bg, text, label } = stressColor(level);
  const accent = stressAccent(level);

  if (loading) {
    return (
      <TrackerPageSkeleton />
    );
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/35 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5 text-[#1E1B31]" />
        </Link>
        <h1 className="text-xl font-bold text-[#1E1B31]">Stress Level</h1>
        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-xs text-slate-400">Saving...</span>}
          {saveStatus === "saved" && <span className="text-xs text-emerald-500">Saved ✓</span>}
          {saveStatus === "error" && <span className="text-xs text-amber-600">Could not save</span>}
        </div>
      </div>

      {/* Main stress display card */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-6 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          {/* Large number */}
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full transition-colors duration-300"
            style={{ backgroundColor: `${accent}18`, border: `3px solid ${accent}` }}
          >
            <span className="text-5xl font-extrabold" style={{ color: accent }}>
              {level}
            </span>
          </div>

          {/* Status badge */}
          <span className={`rounded-full px-4 py-1 text-sm font-semibold ${bg} ${text}`}>
            {label}
          </span>

          {/* Stepper */}
          <div className="mt-2 flex items-center gap-6">
            <button
              onClick={decrement}
              disabled={level === 0}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E1B31] text-white shadow-md transition-opacity disabled:opacity-30"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="w-12 text-center text-2xl font-bold text-[#1E1B31]">{level}/10</div>
            <button
              onClick={increment}
              disabled={level === 10}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E1B31] text-white shadow-md transition-opacity disabled:opacity-30"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mood selector */}
      <div className="mt-6 rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold text-[#1E1B31]">How are you feeling?</h2>
        <div className="flex flex-wrap gap-2">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => handleSetMood(mood)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedMood === mood
                  ? "bg-[#1E1B31] text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mt-6 rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold text-[#1E1B31]">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add any additional context about how you're feeling..."
          rows={4}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#1E1B31] focus:outline-none focus:ring-1 focus:ring-[#1E1B31]"
        />
      </div>

      {/* Tips card */}
      <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="text-sm font-medium text-green-800">
          💡 Try 5 minutes of deep breathing to lower stress levels
        </p>
      </div>
    </div>
  );
}
