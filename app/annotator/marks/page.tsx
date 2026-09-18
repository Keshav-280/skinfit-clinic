"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Eraser,
} from "lucide-react";

type MarkCategory = "acne_scar" | "dark_spot" | "mole" | "active_acne";

type MarkCircle = {
  id: string;
  imageIndex: number;
  fileName: string;
  category: MarkCategory;
  cx: number;
  cy: number;
  r: number;
  iw: number;
  ih: number;
};

type LibraryImage = {
  id: number;
  fileName: string;
  imageUrl: string | null;
  sortOrder: number;
};

const CATEGORIES: Array<{ key: MarkCategory; label: string; hotkey: string; color: string }> = [
  { key: "acne_scar", label: "Acne scar", hotkey: "1", color: "#ef4444" },
  { key: "dark_spot", label: "Dark spot", hotkey: "2", color: "#f59e0b" },
  { key: "mole", label: "Mole", hotkey: "3", color: "#8b5cf6" },
  { key: "active_acne", label: "Active acne", hotkey: "4", color: "#ec4899" },
];
const COLOR: Record<MarkCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color])
) as Record<MarkCategory, string>;

const DEFAULT_R = 0.018;
const MIN_R = 0.005;
const MAX_R = 0.12;
const SAVE_DEBOUNCE_MS = 700;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MarksAnnotatorPage() {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [idx, setIdx] = useState(0);
  const [circles, setCircles] = useState<MarkCircle[]>([]);
  const [category, setCategory] = useState<MarkCategory>("acne_scar");
  const [radius, setRadius] = useState(DEFAULT_R);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [userName, setUserName] = useState<string>("");

  const undoStack = useRef<MarkCircle[][]>([]);
  const saveTimer = useRef<number | null>(null);
  const hydrated = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const current = images[idx] ?? null;
  const currentCircles = useMemo(
    () => circles.filter((c) => c.imageIndex === idx),
    [circles, idx]
  );
  const countByImage = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of circles) m.set(c.imageIndex, (m.get(c.imageIndex) ?? 0) + 1);
    return m;
  }, [circles]);

  useEffect(() => {
    (async () => {
      try {
        const [imgRes, stRes] = await Promise.all([
          fetch("/api/annotator/images", { cache: "no-store" }),
          fetch("/api/annotator/marks", { cache: "no-store" }),
        ]);
        if (!imgRes.ok || !stRes.ok) throw new Error("Failed to load");
        const imgJson = await imgRes.json();
        const stJson = await stRes.json();
        setImages(imgJson.images ?? []);
        setCircles(Array.isArray(stJson.circles) ? stJson.circles : []);
        setUserName(stJson.currentUser?.name ?? "");
        const last = Number(window.localStorage.getItem("marks:idx") ?? "0");
        if (Number.isFinite(last) && last >= 0 && last < (imgJson.images?.length ?? 0)) setIdx(last);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        hydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem("marks:idx", String(idx));
    setSelectedId(null);
    setDims(null);
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  const persist = useCallback((next: MarkCircle[]) => {
    setSaveState("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/annotator/marks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ circles: next }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (updater: (prev: MarkCircle[]) => MarkCircle[]) => {
      setCircles((prev) => {
        undoStack.current.push(prev);
        if (undoStack.current.length > 100) undoStack.current.shift();
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setCircles(prev);
    setSelectedId(null);
    persist(prev);
  }, [persist]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    commit((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }, [commit, selectedId]);

  const clearImage = useCallback(() => {
    if (currentCircles.length === 0) return;
    if (!window.confirm(`Remove all ${currentCircles.length} circles on this image?`)) return;
    commit((prev) => prev.filter((c) => c.imageIndex !== idx));
    setSelectedId(null);
  }, [commit, currentCircles.length, idx]);

  const go = useCallback(
    (delta: number) => setIdx((i) => Math.max(0, Math.min(images.length - 1, i + delta))),
    [images.length]
  );

  const adjustRadius = useCallback(
    (factor: number) => {
      if (selectedId) {
        commit((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, r: Math.max(MIN_R, Math.min(MAX_R, c.r * factor)) } : c
          )
        );
      } else {
        setRadius((r) => Math.max(MIN_R, Math.min(MAX_R, r * factor)));
      }
    },
    [commit, selectedId]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      else if (e.key === "Escape") setSelectedId(null);
      else if (e.key === "]") adjustRadius(1.15);
      else if (e.key === "[") adjustRadius(1 / 1.15);
      else {
        const cat = CATEGORIES.find((c) => c.hotkey === e.key);
        if (cat) setCategory(cat.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjustRadius, go, removeSelected, undo]);

  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !dims || !current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

    // Click inside an existing circle selects it (aspect-correct distance).
    const aspect = dims.w / dims.h;
    const hit = [...currentCircles].reverse().find((c) => {
      const dx = nx - c.cx;
      const dy = (ny - c.cy) / aspect;
      return Math.hypot(dx, dy) <= c.r;
    });
    if (hit) {
      setSelectedId((s) => (s === hit.id ? null : hit.id));
      return;
    }

    const circle: MarkCircle = {
      id: newId(),
      imageIndex: idx,
      fileName: current.fileName,
      category,
      cx: nx,
      cy: ny,
      r: radius,
      iw: dims.w,
      ih: dims.h,
    };
    commit((prev) => [...prev, circle]);
    setSelectedId(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  };

  const exportJson = () => {
    const payload = {
      schemaVersion: "marks-1",
      exportedAt: new Date().toISOString(),
      classes: CATEGORIES.map((c) => c.key),
      images: images.map((im, i) => ({ index: i, id: im.id, fileName: im.fileName })),
      circles,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `skinfit-marks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const annotatedImages = countByImage.size;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading library...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-red-400">{error}</div>
    );
  }
  if (images.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <p>No images in the annotator library.</p>
        <Link href="/annotator" className="text-teal-400 underline">
          Upload images in the main annotator
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Link href="/annotator" className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={16} /> Annotator
        </Link>
        <h1 className="text-sm font-semibold">Mark circles</h1>
        <span className="text-xs text-zinc-500">
          {annotatedImages}/{images.length} images marked · {circles.length} circles
          {userName ? ` · ${userName}` : ""}
        </span>

        <div className="mx-2 flex items-center gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                category === c.key ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title={`Hotkey ${c.hotkey}`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              {c.label}
              <kbd className="ml-1 rounded bg-black/20 px-1 text-[10px]">{c.hotkey}</kbd>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Size
          <input
            type="range"
            min={MIN_R}
            max={MAX_R}
            step={0.001}
            value={selectedId ? currentCircles.find((c) => c.id === selectedId)?.r ?? radius : radius}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (selectedId) {
                commit((prev) => prev.map((c) => (c.id === selectedId ? { ...c, r: v } : c)));
              } else setRadius(v);
            }}
            className="w-28 accent-teal-400"
          />
          <kbd className="rounded bg-zinc-800 px-1 text-[10px]">[ ]</kbd>
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 1.25))} className="rounded p-1.5 hover:bg-zinc-800" title="Zoom out (Ctrl+scroll)">
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs text-zinc-400">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(5, z * 1.25))} className="rounded p-1.5 hover:bg-zinc-800" title="Zoom in (Ctrl+scroll)">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={undo} className="rounded p-1.5 hover:bg-zinc-800" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selectedId}
            className="rounded p-1.5 hover:bg-zinc-800 disabled:opacity-30"
            title="Delete selected (Del)"
          >
            <Trash2 size={16} />
          </button>
          <button type="button" onClick={clearImage} className="rounded p-1.5 hover:bg-zinc-800" title="Clear this image">
            <Eraser size={16} />
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="ml-2 flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium hover:bg-teal-500"
          >
            <Download size={14} /> Export
          </button>
          <span
            className={`ml-2 text-xs ${
              saveState === "error" ? "text-red-400" : saveState === "saved" ? "text-teal-400" : "text-zinc-500"
            }`}
          >
            {saveState === "saving" ? "Saving..." : saveState === "dirty" ? "Unsaved" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="px-2 text-zinc-500 hover:text-zinc-200 disabled:opacity-20">
          <ChevronLeft size={28} />
        </button>

        <div className="min-h-0 flex-1 overflow-auto bg-black" onWheel={onWheel}>
          <div className="flex min-h-full min-w-full items-center justify-center p-4">
            <div className="relative" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : undefined }}>
              {current?.imageUrl ? (
                <img
                  src={current.imageUrl}
                  alt={current.fileName}
                  draggable={false}
                  onLoad={(e) => {
                    const im = e.currentTarget;
                    setDims({ w: im.naturalWidth, h: im.naturalHeight });
                  }}
                  className="block h-auto w-full select-none"
                  style={{ maxHeight: zoom === 1 ? "calc(100vh - 11rem)" : undefined, objectFit: "contain" }}
                />
              ) : null}
              {dims ? (
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${dims.w} ${dims.h}`}
                  className="absolute inset-0 h-full w-full cursor-crosshair"
                  onClick={onCanvasClick}
                >
                  {currentCircles.map((c) => {
                    const sel = c.id === selectedId;
                    const rpx = c.r * dims.w;
                    return (
                      <g key={c.id}>
                        <circle
                          cx={c.cx * dims.w}
                          cy={c.cy * dims.h}
                          r={rpx}
                          fill={sel ? `${COLOR[c.category]}22` : "none"}
                          stroke={COLOR[c.category]}
                          strokeWidth={Math.max(2, dims.w / 500)}
                          strokeDasharray={`${Math.max(6, dims.w / 200)} ${Math.max(4, dims.w / 300)}`}
                        />
                        {sel ? (
                          <circle cx={c.cx * dims.w} cy={c.cy * dims.h} r={rpx + dims.w / 200} fill="none" stroke="#fff" strokeWidth={Math.max(1, dims.w / 900)} />
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              ) : null}
            </div>
          </div>
        </div>

        <button type="button" onClick={() => go(1)} disabled={idx >= images.length - 1} className="px-2 text-zinc-500 hover:text-zinc-200 disabled:opacity-20">
          <ChevronRight size={28} />
        </button>
      </div>

      <footer className="border-t border-zinc-800">
        <div className="flex items-center justify-between px-4 py-1 text-xs text-zinc-500">
          <span>
            {idx + 1} / {images.length} · {current?.fileName}
            {dims ? ` · ${dims.w}x${dims.h}` : ""}
          </span>
          <span>
            Click to circle · click a circle to select · Del removes · [ ] resize · 1-4 category · arrows navigate
          </span>
        </div>
        <div ref={stripRef} className="flex gap-1 overflow-x-auto px-4 pb-2">
          {images.map((im, i) => {
            const n = countByImage.get(i) ?? 0;
            return (
              <button
                key={im.id}
                type="button"
                data-idx={i}
                onClick={() => setIdx(i)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded ${
                  i === idx ? "ring-2 ring-teal-400" : "opacity-70 hover:opacity-100"
                }`}
                title={im.fileName}
              >
                {im.imageUrl ? (
                  <img src={`${im.imageUrl}?w=112`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : null}
                {n > 0 ? (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-teal-500 px-1 text-[10px] font-semibold text-black">
                    {n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
