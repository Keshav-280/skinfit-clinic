"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Trash2,
  Pencil,
  Minus,
  Eraser,
  Sun,
  Moon,
  Info,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";
import {
  SEVERITY_GRADE_OPTIONS,
  type SeverityGrade,
  normalizeSeverityGrade,
} from "@/src/lib/annotatorSeverityGrade";

const ALL_CATEGORIES = [
  "Active Acne",
  "Acne Scars",
  "Pigmentation",
  "Wrinkles",
  "Sagging & Volume",
  "Under-Eye",
] as const;

type Category = (typeof ALL_CATEGORIES)[number];

/** Path / line / eraser only apply to these four. */
const DRAWABLE_CATEGORIES: Category[] = [
  "Active Acne",
  "Acne Scars",
  "Pigmentation",
  "Under-Eye",
];

const SCORE_ONLY_CATEGORIES: Category[] = ALL_CATEGORIES.filter(
  (c) => !DRAWABLE_CATEGORIES.includes(c)
);

const CLINICAL_TAXONOMY: Record<Category, string[]> = {
  "Active Acne": ["Comedones (Black/Whiteheads)", "Papules / Pustules", "Nodules / Cysts", "Inflammation (Erythema)"],
  "Acne Scars": ["Ice-pick", "Boxcar", "Rolling"],
  Pigmentation: ["Melasma", "Post-Acne Marks (PIH/PIE)", "Sun Spots"],
  Wrinkles: ["Forehead & Glabella", "Crow's Feet", "Nasolabial & Marionette"],
  "Sagging & Volume": ["Tear Trough", "Midface Flattening", "Jowl & Jawline"],
  "Under-Eye": ["Puffiness (Fluid/Fat)", "Dark Circles (Pigmented/Vascular)"],
};

type CategoryEntry = { spec: string; grade: SeverityGrade };

function defaultEntry(cat: Category): CategoryEntry {
  const specs = CLINICAL_TAXONOMY[cat];
  return { spec: specs[0] ?? "", grade: "A" };
}

function normalizeCategoryEntry(raw: {
  spec?: string;
  grade?: unknown;
  score?: unknown;
}): CategoryEntry {
  return {
    spec: typeof raw.spec === "string" ? raw.spec : "",
    grade: normalizeSeverityGrade(raw.grade ?? raw.score, "A"),
  };
}

function migratePerImageByCategory(
  raw: Record<number, Partial<Record<Category, Partial<CategoryEntry & { score?: number }>>>>
): Record<number, Partial<Record<Category, Partial<CategoryEntry>>>> {
  const out: Record<number, Partial<Record<Category, Partial<CategoryEntry>>>> = {};
  for (const [idx, patch] of Object.entries(raw)) {
    const imageIndex = Number(idx);
    if (!Number.isFinite(imageIndex) || !patch) continue;
    const migrated: Partial<Record<Category, Partial<CategoryEntry>>> = {};
    for (const c of ALL_CATEGORIES) {
      const entry = patch[c];
      if (entry) migrated[c] = normalizeCategoryEntry(entry);
    }
    out[imageIndex] = migrated;
  }
  return out;
}

function migrateAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object")
    .map((a) => {
      const ann = a as Annotation & { severity: unknown };
      return {
        ...ann,
        severity: normalizeSeverityGrade(ann.severity, "A"),
      };
    });
}

function fullDefaults(): Record<Category, CategoryEntry> {
  return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, defaultEntry(c)])) as Record<
    Category,
    CategoryEntry
  >;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

const CATEGORY_COLORS: Record<Category, string> = {
  "Active Acne": "rgb(239, 68, 68)",
  "Acne Scars": "rgb(185, 28, 28)",
  Pigmentation: "rgb(59, 130, 246)",
  Wrinkles: "rgb(168, 85, 247)",
  "Sagging & Volume": "rgb(236, 72, 153)",
  "Under-Eye": "rgb(14, 165, 233)",
};

interface Annotation {
  id: string;
  imageIndex: number;
  category: string;
  spec: string;
  severity: SeverityGrade;
  color: string;
  type: "path" | "line";
  points: { x: number; y: number }[];
}

type PersistedImage = {
  id: number;
  fileName: string;
  mimeType: string;
  dataUri: string;
  sortOrder: number;
};

let annotationIdCounter = 0;

function cloneAnnotations(list: Annotation[]): Annotation[] {
  return list.map((a) => ({
    ...a,
    points: a.points.map((p) => ({ ...p })),
  }));
}

function getNormalizedPoint(
  e: React.MouseEvent,
  el: HTMLDivElement | null
): { x: number; y: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  return { x, y };
}

function pointsToPathD(points: { x: number; y: number }[], close: boolean): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  if (close && points.length > 2) d += " Z";
  return d;
}

function pointsToPolylinePoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export default function AnnotatorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(Date.now());

  const [images, setImages] = useState<string[]>([]);
  /** Original file names from upload (same order as `images`). */
  const [imageMeta, setImageMeta] = useState<{ name: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<string>("path");
  const [activeCategory, setActiveCategory] = useState<Category>("Active Acne");
  const [perImageByCategory, setPerImageByCategory] = useState<
    Record<number, Partial<Record<Category, Partial<CategoryEntry>>>>
  >({});
  const [annotationHistory, setAnnotationHistory] = useState<{
    snapshots: Annotation[][];
    index: number;
  }>({ snapshots: [[]], index: 0 });

  const annotations = annotationHistory.snapshots[annotationHistory.index];
  const canUndoAnnotation = annotationHistory.index > 0;
  const canRedoAnnotation = annotationHistory.index < annotationHistory.snapshots.length - 1;

  const commitAnnotations = useCallback((updater: (prev: Annotation[]) => Annotation[]) => {
    setAnnotationHistory((ah) => {
      const cur = ah.snapshots[ah.index];
      const next = updater(cur);
      const list = ah.snapshots.slice(0, ah.index + 1);
      list.push(cloneAnnotations(next));
      return { snapshots: list, index: list.length - 1 };
    });
  }, []);

  const undoAnnotation = useCallback(() => {
    setAnnotationHistory((ah) => ({
      ...ah,
      index: Math.max(0, ah.index - 1),
    }));
  }, []);

  const redoAnnotation = useCallback(() => {
    setAnnotationHistory((ah) => ({
      ...ah,
      index: Math.min(ah.snapshots.length - 1, ah.index + 1),
    }));
  }, []);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    step: "category" | "spec" | "severity";
    tempCategory?: string;
    tempSpec?: string;
  } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [imageZoom, setImageZoom] = useState(1);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isImportingFolder, setIsImportingFolder] = useState(false);
  const [lastPersistMessage, setLastPersistMessage] = useState<string>("");

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  React.useEffect(() => {
    if (!DRAWABLE_CATEGORIES.includes(activeCategory) && (activeTool === "path" || activeTool === "line")) {
      setActiveTool("eraser");
    }
  }, [activeCategory, activeTool]);

  React.useEffect(() => {
    setImgNatural(null);
  }, [currentIndex, images]);

  React.useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [imagesRes, stateRes] = await Promise.all([
          fetch("/api/annotator/images", { cache: "no-store" }),
          fetch("/api/annotator/state", { cache: "no-store" }),
        ]);
        const imagesJson = await imagesRes.json();
        const stateJson = await stateRes.json();
        if (!isMounted) return;

        const persistedImages = (imagesJson.images ?? []) as PersistedImage[];
        let activeImages = persistedImages;

        // If DB is empty, auto-import from images_face so non-technical users can start immediately.
        if (activeImages.length === 0) {
          setLastPersistMessage("Importing images from images_face...");
          const importRes = await fetch("/api/annotator/import-from-folder", { method: "POST" });
          const importJson = await importRes.json().catch(() => ({}));
          if (importRes.ok) {
            activeImages = (importJson.images ?? []) as PersistedImage[];
            setLastPersistMessage(
              `Auto-imported ${importJson.importedCount ?? 0}, skipped ${importJson.skippedCount ?? 0}`
            );
          } else {
            setLastPersistMessage(importJson?.message || importJson?.error || "Auto-import failed");
          }
        }

        setImages(activeImages.map((img) => img.dataUri));
        setImageMeta(activeImages.map((img) => ({ name: img.fileName })));

        const persistedState = stateJson.state;
        if (persistedState) {
          setPerImageByCategory(
            migratePerImageByCategory(
              (persistedState.perImageByCategory ?? {}) as Parameters<
                typeof migratePerImageByCategory
              >[0]
            )
          );
          const persistedAnnotations = migrateAnnotations(persistedState.annotations);
          setAnnotationHistory({ snapshots: [cloneAnnotations(persistedAnnotations)], index: 0 });
          const maxCounter = persistedAnnotations.reduce((acc, ann) => {
            const idNum = Number.parseInt(String(ann.id).replace("ann-", ""), 10);
            return Number.isFinite(idNum) ? Math.max(acc, idNum) : acc;
          }, 0);
          annotationIdCounter = Math.max(annotationIdCounter, maxCounter);
          setCurrentIndex(
            Math.max(
              0,
              Math.min(
                (persistedState.currentIndex as number) ?? 0,
                Math.max(0, activeImages.length - 1)
              )
            )
          );
        } else {
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error("Failed to hydrate annotator data", err);
      } finally {
        if (isMounted) setIsHydrating(false);
      }
    };
    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (isHydrating) return;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/annotator/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perImageByCategory,
            annotations,
            currentIndex,
          }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        setLastPersistMessage(`Saved ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error("Failed to save annotator state", err);
        setLastPersistMessage("Save failed");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isHydrating, perImageByCategory, annotations, currentIndex]);

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el || images.length === 0) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setImageZoom((z) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100))
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [images.length, currentIndex]);

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const categoryState = React.useMemo(() => {
    const base = fullDefaults();
    const patch = perImageByCategory[currentIndex] ?? {};
    const out = { ...base };
    for (const c of ALL_CATEGORIES) {
      if (patch[c]) out[c] = { ...base[c], ...normalizeCategoryEntry(patch[c]!) };
    }
    return out;
  }, [perImageByCategory, currentIndex]);

  const setCategorySpec = useCallback((imageIndex: number, cat: Category, spec: string) => {
    setPerImageByCategory((prev) => {
      const cur = prev[imageIndex] ?? {};
      const prevEntry = { ...defaultEntry(cat), ...cur[cat] };
      return {
        ...prev,
        [imageIndex]: { ...cur, [cat]: { ...prevEntry, spec } },
      };
    });
  }, []);

  const setCategoryGrade = useCallback((imageIndex: number, cat: Category, grade: SeverityGrade) => {
    setPerImageByCategory((prev) => {
      const cur = prev[imageIndex] ?? {};
      const prevEntry = { ...defaultEntry(cat), ...cur[cat] };
      return {
        ...prev,
        [imageIndex]: { ...cur, [cat]: { ...prevEntry, grade } },
      };
    });
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (images.length === 0) return;
      if (e.ctrlKey || e.metaKey) return;

      const now = Date.now();
      if (now - lastScrollTime.current < 400) return;

      if (e.deltaX > 40) {
        setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
        lastScrollTime.current = now;
      } else if (e.deltaX < -40) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        lastScrollTime.current = now;
      }
    },
    [images.length]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (images.length === 0) return;
      const pt = getNormalizedPoint(e, canvasRef.current);
      if (!pt) return;

      const canDraw = DRAWABLE_CATEGORIES.includes(activeCategory);
      if ((activeTool === "path" || activeTool === "line") && canDraw) {
        setIsDrawing(true);
        setCurrentStrokePoints([pt]);
      }
      // Eraser: handled by shape onClick
    },
    [images.length, activeTool, activeCategory]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing || (activeTool !== "path" && activeTool !== "line")) return;
      const pt = getNormalizedPoint(e, canvasRef.current);
      if (!pt) return;
      setCurrentStrokePoints((prev) => [...prev, pt]);
    },
    [isDrawing, activeTool]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    if (!DRAWABLE_CATEGORIES.includes(activeCategory)) {
      setIsDrawing(false);
      setCurrentStrokePoints([]);
      return;
    }
    const { spec, grade } = categoryState[activeCategory];
    if (activeTool === "path" && currentStrokePoints.length >= 3) {
      const color = CATEGORY_COLORS[activeCategory] ?? "rgb(156, 163, 175)";
      commitAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${++annotationIdCounter}`,
          imageIndex: currentIndex,
          category: activeCategory,
          spec,
          severity: grade,
          color,
          type: "path",
          points: [...currentStrokePoints],
        },
      ]);
    } else if (activeTool === "line" && currentStrokePoints.length >= 2) {
      const color = CATEGORY_COLORS[activeCategory] ?? "rgb(156, 163, 175)";
      commitAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${++annotationIdCounter}`,
          imageIndex: currentIndex,
          category: activeCategory,
          spec,
          severity: grade,
          color,
          type: "line",
          points: [...currentStrokePoints],
        },
      ]);
    }
    setIsDrawing(false);
    setCurrentStrokePoints([]);
  }, [
    isDrawing,
    activeTool,
    currentStrokePoints,
    currentIndex,
    activeCategory,
    categoryState,
    commitAnnotations,
  ]);

  React.useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    const imagePayload = await Promise.all(
      list.map(async (f) => {
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        return {
          fileName: f.name,
          mimeType: f.type || "image/jpeg",
          dataUri,
        };
      })
    );

    try {
      const res = await fetch("/api/annotator/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imagePayload }),
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const json = await res.json();
      const created = (json.images ?? []) as PersistedImage[];
      setImages((prev) => [...prev, ...created.map((img) => img.dataUri)]);
      setImageMeta((prev) => [...prev, ...created.map((img) => ({ name: img.fileName }))]);
      setCurrentIndex(0);
      setLastPersistMessage(`Uploaded ${created.length} image(s)`);
    } catch (err) {
      console.error("Failed to upload images", err);
      setLastPersistMessage("Image upload failed");
    }
    e.target.value = "";
  };

  const importFromFolder = useCallback(async () => {
    try {
      setIsImportingFolder(true);
      const res = await fetch("/api/annotator/import-from-folder", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message || json?.error || "Import failed";
        setLastPersistMessage(msg);
        return;
      }
      const all = (json.images ?? []) as PersistedImage[];
      setImages(all.map((img) => img.dataUri));
      setImageMeta(all.map((img) => ({ name: img.fileName })));
      setCurrentIndex(0);
      setLastPersistMessage(
        `Imported ${json.importedCount ?? 0}, skipped ${json.skippedCount ?? 0}`
      );
    } catch (err) {
      console.error("Failed to import images from folder", err);
      setLastPersistMessage("Folder import failed");
    } finally {
      setIsImportingFolder(false);
    }
  }, []);

  const exportAnnotationsJson = useCallback(() => {
    if (images.length === 0) return;

    const labelsByImageIndex: Record<string, Record<Category, CategoryEntry>> = {};
    for (let i = 0; i < images.length; i++) {
      const base = fullDefaults();
      const patch = perImageByCategory[i] ?? {};
      const merged = { ...base };
      for (const c of ALL_CATEGORIES) {
        if (patch[c]) merged[c] = normalizeCategoryEntry({ ...base[c], ...patch[c] });
      }
      labelsByImageIndex[String(i)] = merged;
    }

    const payload = {
      schemaVersion: 1,
      app: "skinnfit-clinical-annotator",
      exportedAt: new Date().toISOString(),
      note:
        "Images are not embedded. Keep your original files and match them to `images[].fileName` and `images[].index`. Annotation points are normalized 0–1 relative to image width/height. Severity is stored as letter grades A–E (A = least severe, E = most severe) in labelsByImageIndex[].grade and annotations[].severity.",
      imageCount: images.length,
      images: images.map((_, i) => ({
        index: i,
        fileName: imageMeta[i]?.name ?? `image-${i + 1}`,
      })),
      labelsByImageIndex,
      annotations: cloneAnnotations(annotations),
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `skinnfit-annotations-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [images, imageMeta, perImageByCategory, annotations]);

  const deleteAnnotation = useCallback(
    (id: string) => {
      commitAnnotations((prev) => prev.filter((a) => a.id !== id));
    },
    [commitAnnotations]
  );

  const handleShapeClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (activeTool === "eraser") {
        deleteAnnotation(id);
      }
    },
    [activeTool, deleteAnnotation]
  );

  const currentAnnotations = annotations.filter((a) => a.imageIndex === currentIndex);
  const activeSpecs = CLINICAL_TAXONOMY[activeCategory];
  const activeIsDrawable = DRAWABLE_CATEGORIES.includes(activeCategory);
  const { spec: activeSpec, grade: activeGrade } = categoryState[activeCategory];

  const displaySize = React.useMemo(() => {
    if (!imgNatural) return null;
    return {
      w: Math.max(1, Math.round(imgNatural.w * imageZoom)),
      h: Math.max(1, Math.round(imgNatural.h * imageZoom)),
    };
  }, [imgNatural, imageZoom]);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top Nav */}
      <nav className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-4">
          <Link
            href="/clinic"
            className="text-slate-500 transition-colors hover:text-teal-500 dark:text-zinc-500 dark:hover:text-teal-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Skinnfit Clinical Annotator
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="mr-1 flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-zinc-700 sm:mr-2 sm:pr-3">
            <button
              type="button"
              onClick={undoAnnotation}
              disabled={!canUndoAnnotation}
              className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:disabled:opacity-30"
              title="Undo last shape (annotations)"
            >
              <Undo2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={redoAnnotation}
              disabled={!canRedoAnnotation}
              className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:disabled:opacity-30"
              title="Redo annotation"
            >
              <Redo2 className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsDarkMode((d) => !d)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
            title="View tutorial"
          >
            <Info className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={exportAnnotationsJson}
            disabled={images.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            title="Download all labels and shapes as JSON (images not included — keep your files)"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-teal-400"
          >
            <Upload className="h-4 w-4" />
            Upload Images
          </button>
          <button
            type="button"
            onClick={importFromFolder}
            disabled={isImportingFolder}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-500 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
            title="Bulk import from root/images_face and save to database"
          >
            {isImportingFolder ? "Importing..." : "Import images_face"}
          </button>
        </div>
      </nav>
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-1.5 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {isHydrating
          ? lastPersistMessage || "Loading saved annotator data..."
          : lastPersistMessage || "All data is persisted to database."}
      </div>

      {/* Main Content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(160px,42vh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[1fr_minmax(320px,22rem)] lg:grid-rows-1">
        {/* Left Canvas — scrollable, no clipping; zoom keeps full image visible */}
        <div className="relative flex min-h-0 flex-col items-center overflow-auto bg-slate-100 p-4 dark:bg-zinc-950 lg:p-6">
          {images.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-zinc-500">
              <div className="rounded-full border-2 border-dashed border-slate-300 p-8 dark:border-zinc-700">
                <Upload className="h-16 w-16" />
              </div>
              <p className="text-sm">No images uploaded</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-teal-500 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
              >
                Click to upload images
              </button>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-30 mb-3 flex w-full max-w-md flex-wrap items-center justify-center gap-1.5 self-center rounded-xl border-2 border-slate-400 bg-white px-3 py-2.5 shadow-md ring-1 ring-slate-900/10 dark:border-zinc-500 dark:bg-zinc-800 dark:ring-white/10">
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))}
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4 shrink-0 stroke-[2.5]" />
                </button>
                <span className="min-w-[3.5rem] text-center text-sm font-bold tabular-nums text-slate-950 dark:text-white">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))}
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4 shrink-0 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
                  title="Reset zoom"
                >
                  <RotateCcw className="h-4 w-4 shrink-0 stroke-[2.5]" />
                </button>
                <span className="w-full px-1 text-center text-[11px] font-medium leading-snug text-slate-800 dark:text-zinc-200 sm:w-auto">
                  Ctrl+scroll or Cmd+scroll to zoom
                </span>
              </div>

              <div className="relative mx-auto flex w-full min-w-0 flex-1 justify-center px-14">
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/80 text-white transition-colors hover:bg-slate-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <div
                  ref={canvasRef}
                  className="relative shrink-0 select-none"
                  style={
                    displaySize
                      ? { width: displaySize.w, height: displaySize.h }
                      : { width: "fit-content", height: "fit-content" }
                  }
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onWheel={handleWheel}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const safeX = e.clientX + 260 > window.innerWidth ? window.innerWidth - 270 : e.clientX;
                    const safeY = e.clientY + 350 > window.innerHeight ? window.innerHeight - 360 : e.clientY;
                    setContextMenu({
                      visible: true,
                      x: safeX,
                      y: safeY,
                      step: "category",
                    });
                  }}
                >
                  <img
                    src={images[currentIndex]}
                    alt={`Scan ${currentIndex + 1}`}
                    draggable={false}
                    onLoad={(e) => {
                      const t = e.currentTarget;
                      setImgNatural({ w: t.naturalWidth, h: t.naturalHeight });
                    }}
                    className={
                      displaySize
                        ? "absolute inset-0 block h-full w-full object-contain"
                        : "block max-h-[min(90dvh,1200px)] w-auto max-w-full object-contain"
                    }
                  />

                  {/* SVG Drawing Layer */}
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    style={{ pointerEvents: activeTool === "eraser" ? "auto" : "none" }}
                  >
                    {/* Rendered annotations */}
                    {currentAnnotations.map((ann) => (
                      <g
                        key={ann.id}
                        style={{
                          cursor: activeTool === "eraser" ? "pointer" : "default",
                          pointerEvents: "painted",
                        }}
                        onClick={(e) => handleShapeClick(e as unknown as React.MouseEvent, ann.id)}
                      >
                        {ann.type === "path" ? (
                          <path
                            d={pointsToPathD(ann.points, true)}
                            fill={ann.color}
                            fillOpacity={0.25}
                            stroke={ann.color}
                            strokeWidth={0.005}
                            className={activeTool === "eraser" ? "hover:opacity-80" : ""}
                          />
                        ) : (
                          <polyline
                            points={pointsToPolylinePoints(ann.points)}
                            fill="none"
                            stroke={ann.color}
                            strokeWidth={0.005}
                            className={activeTool === "eraser" ? "hover:opacity-80" : ""}
                          />
                        )}
                        <text
                          x={ann.points[0]?.x ?? 0}
                          y={(ann.points[0]?.y ?? 0) - 0.03}
                          fontSize={0.03}
                          fill={ann.color}
                          fontWeight="bold"
                          style={{ pointerEvents: "none" }}
                        >
                          {ann.spec} — {ann.severity}
                        </text>
                      </g>
                    ))}

                    {/* Drawing preview */}
                    {isDrawing && currentStrokePoints.length >= 2 && (
                      <>
                        {activeTool === "path" ? (
                          <path
                            d={pointsToPathD(currentStrokePoints, false)}
                            fill="rgb(45, 212, 191)"
                            fillOpacity={0.25}
                            stroke="rgb(45, 212, 191)"
                            strokeWidth={0.005}
                            strokeDasharray="0.01 0.01"
                          />
                        ) : (
                          <polyline
                            points={pointsToPolylinePoints(currentStrokePoints)}
                            fill="none"
                            stroke="rgb(45, 212, 191)"
                            strokeWidth={0.005}
                            strokeDasharray="0.01 0.01"
                          />
                        )}
                      </>
                    )}
                  </svg>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/80 text-white transition-colors hover:bg-slate-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-800"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
              <p className="mt-4 shrink-0 text-sm text-slate-500 dark:text-zinc-500">
                Image {currentIndex + 1} of {images.length}
              </p>
            </>
          )}
        </div>

        {/* Right Sidebar — classic layout: tools, category grid, spec (drawable only), score for all */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:border-l lg:border-t-0 lg:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Crosshair className="h-4 w-4 shrink-0 text-teal-400" />
            Annotation Tools
          </h2>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTool("path")}
              disabled={images.length === 0 || !activeIsDrawable}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool === "path"
                  ? "bg-teal-500 text-zinc-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Pencil className="h-4 w-4" />
              Path
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("line")}
              disabled={images.length === 0 || !activeIsDrawable}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool === "line"
                  ? "bg-teal-500 text-zinc-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Minus className="h-4 w-4" />
              Line
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("eraser")}
              disabled={images.length === 0}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                activeTool === "eraser"
                  ? "bg-teal-500 text-zinc-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Eraser className="h-4 w-4" />
              Eraser
            </button>
          </div>

          <div className="mb-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Score + specification + draw
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {DRAWABLE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors ${
                      activeCategory === cat
                        ? "bg-teal-500 text-zinc-950"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                Score only
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {SCORE_ONLY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors ${
                      activeCategory === cat
                        ? "bg-teal-500 text-zinc-950"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {activeIsDrawable ? (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                Specification
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {activeSpecs.map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    disabled={images.length === 0}
                    onClick={() => setCategorySpec(currentIndex, activeCategory, spec)}
                    className={`rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors disabled:opacity-40 ${
                      activeSpec === spec
                        ? "bg-teal-500/80 text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
              <strong className="text-slate-800 dark:text-zinc-200">Score only</strong> — set severity below. Use{" "}
              <span className="text-teal-700 dark:text-teal-400">Score + specification + draw</span> to pick a spec
              and paint regions.
            </p>
          )}

          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              Severity grade (A–E) · {activeCategory}
            </label>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-zinc-500">
              A = least severe (1), E = most severe (5). Applies to this category on the current image (all six have a grade; drawable ones also
              use it on new strokes).
            </p>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_GRADE_OPTIONS.map(({ grade }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={images.length === 0}
                  onClick={() => setCategoryGrade(currentIndex, activeCategory, grade)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                    activeGrade === grade
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-slate-200 pt-4 dark:border-zinc-800">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              Annotation list
            </label>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {currentAnnotations.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500 dark:text-zinc-500">
                  Use Path or Line on a drawable category to draw on the image
                </p>
              ) : (
                currentAnnotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                        {ann.spec} — {ann.severity}
                      </p>
                      <p className="truncate text-[10px] text-slate-500 dark:text-zinc-500">
                        {ann.category} ({ann.type})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteAnnotation(ann.id)}
                      className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-red-500/20 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Context Menu */}
      {contextMenu?.visible && (
        <div
          className="fixed z-[9999] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 context-menu-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Section: Mini-Toolbar */}
          <div className="border-b border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className={`flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs transition-colors ${
                  activeTool === "path" ? "bg-teal-500 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
                }`}
                onClick={() => setActiveTool("path")}
              >
                <Pencil className="h-4 w-4" />
                Path
              </button>
              <button
                type="button"
                className={`flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs transition-colors ${
                  activeTool === "line" ? "bg-teal-500 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
                }`}
                onClick={() => setActiveTool("line")}
              >
                <Minus className="h-4 w-4" />
                Line
              </button>
              <button
                type="button"
                className={`flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs transition-colors ${
                  activeTool === "eraser" ? "bg-teal-500 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
                }`}
                onClick={() => setActiveTool("eraser")}
              >
                <Eraser className="h-4 w-4" />
                Eraser
              </button>
            </div>
          </div>

          {/* Bottom Section: Dynamic Lists (Scrollable) */}
          <div className="max-h-[250px] overflow-y-auto">
            {contextMenu.step === "category" && (
              <div className="py-1">
                {DRAWABLE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-teal-500/20 hover:text-teal-600 dark:text-zinc-300 dark:hover:text-teal-400"
                    onClick={() =>
                      setContextMenu((prev) =>
                        prev ? { ...prev, step: "spec", tempCategory: cat } : null
                      )
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            {contextMenu.step === "spec" && contextMenu.tempCategory && (
              <div className="py-1">
                <button
                  type="button"
                  className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                  onClick={() =>
                    setContextMenu((prev) =>
                      prev ? { ...prev, step: "category", tempCategory: undefined } : null
                    )
                  }
                >
                  ← Back
                </button>
                {(CLINICAL_TAXONOMY[contextMenu.tempCategory as Category] ?? []).map((spec: string) => (
                  <button
                    key={spec}
                    type="button"
                    className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-teal-500/20 hover:text-teal-600 dark:text-zinc-300 dark:hover:text-teal-400"
                    onClick={() =>
                      setContextMenu((prev) =>
                        prev ? { ...prev, step: "severity", tempSpec: spec } : null
                      )
                    }
                  >
                    {spec}
                  </button>
                ))}
              </div>
            )}
            {contextMenu.step === "severity" && contextMenu.tempCategory && contextMenu.tempSpec && (
              <div className="py-1">
                <button
                  type="button"
                  className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                  onClick={() =>
                    setContextMenu((prev) =>
                      prev ? { ...prev, step: "spec", tempSpec: undefined } : null
                    )
                  }
                >
                  ← Back
                </button>
                {SEVERITY_GRADE_OPTIONS.map(({ grade }) => (
                  <button
                    key={grade}
                    type="button"
                    className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-teal-500/20 hover:text-teal-600 dark:text-zinc-300 dark:hover:text-teal-400"
                    onClick={() => {
                      const cat = contextMenu.tempCategory as Category;
                      setActiveCategory(cat);
                      setCategorySpec(currentIndex, cat, contextMenu.tempSpec!);
                      setCategoryGrade(currentIndex, cat, grade);
                      setContextMenu(null);
                    }}
                  >
                    Grade {grade}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTutorial(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowTutorial(false)}
              className="absolute right-4 top-4 rounded p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">
              Skinnfit Clinical Annotation Workflow
            </h2>
            <ol className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">1. Upload &amp; navigate:</span>{" "}
                Load images; horizontal two-finger swipe changes the photo. Scroll the image area to see the full
                picture. Use zoom buttons or Ctrl/Cmd+scroll on the image to zoom (25%–400%).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">2. Categories:</span>{" "}
                <strong>Score + specification + draw</strong> lists the four you can annotate on the image.{" "}
                <strong>Score only</strong> lists the other two (severity grades A–E; A = least severe, E = most severe).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">3. Drawing:</span>{" "}
                Path and Line work only when a drawable category is selected; new strokes use that category&apos;s spec
                and severity.
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">4. Context menu:</span>{" "}
                Right-click the image to jump through drawable category, specification, and score.
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">5. Undo / redo:</span>{" "}
                Top bar — restore or replay the last change to drawn shapes (add or erase).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">6. Save / download:</span>{" "}
                Use <strong>Export JSON</strong> in the top bar. It downloads scores and specs for every image index,
                all drawn shapes (coordinates 0–1 vs image size), and original file names from upload. Pixel images are
                not inside the file — keep those files on disk and match by name/index.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
