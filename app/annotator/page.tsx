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
  severityGradeToScore,
} from "@/src/lib/annotatorSeverityGrade";
import {
  reconcileAnnotationsForImageSet,
  type AnnotatorShape,
} from "@/src/lib/annotatorAnnotations";
import { ANNOTATOR_LOCK_HEARTBEAT_MS } from "@/src/lib/annotatorCollaboration";

/** Background sync poll - lightweight ?sync=1 avoids downloading multi-MB shape JSON. */
const ANNOTATOR_STATE_POLL_MS = 15_000;

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

const CATEGORY_ICONS: Record<Category, string> = {
  "Active Acne": "/annotator/categories/active-acne.jpeg",
  "Acne Scars": "/annotator/categories/acne-scars.jpeg",
  Pigmentation: "/annotator/categories/pigmentation.jpeg",
  "Under-Eye": "/annotator/categories/under-eye.jpeg",
  Wrinkles: "/annotator/categories/wrinkles.jpeg",
  "Sagging & Volume": "/annotator/categories/sagging-volume.jpeg",
};

function CategoryPickerButton({
  category,
  isActive,
  onClick,
}: {
  category: Category;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={category}
      aria-pressed={isActive}
      className={`flex h-[7.75rem] w-full flex-col overflow-hidden rounded-xl p-2 transition-colors ${
        isActive
          ? "bg-[#F8EDEE]0 ring-2 ring-inset ring-teal-200"
          : "bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
    >
      <div className="h-[5.25rem] w-full shrink-0 overflow-hidden rounded-lg bg-zinc-900/30">
        {/* Static public assets - plain img avoids optimizer/layout issues */}
        <img
          src={CATEGORY_ICONS[category]}
          alt=""
          width={160}
          height={120}
          className="h-full w-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      </div>
      <span
        className={`mt-1 flex flex-1 items-center justify-center text-center text-[9px] font-medium leading-tight ${
          isActive ? "text-zinc-950" : "text-slate-600 dark:text-zinc-400"
        }`}
      >
        {category}
      </span>
    </button>
  );
}

const CLINICAL_TAXONOMY: Record<Category, string[]> = {
  "Active Acne": ["Comedones (Black/Whiteheads)", "Papules / Pustules", "Nodules / Cysts", "Inflammation (Erythema)"],
  "Acne Scars": ["Ice-pick", "Boxcar", "Rolling"],
  Pigmentation: ["Melasma", "Post-Acne Marks (PIH/PIE)", "Sun Spots"],
  Wrinkles: ["Forehead & Glabella", "Crow's Feet", "Nasolabial & Marionette"],
  "Sagging & Volume": ["Tear Trough", "Midface Flattening", "Jowl & Jawline"],
  "Under-Eye": ["Puffiness (Fluid/Fat)", "Dark Circles (Pigmented/Vascular)"],
};

type CategoryEntry = { spec: string; grade: SeverityGrade };

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function defaultEntry(cat: Category): CategoryEntry {
  if (DRAWABLE_CATEGORIES.includes(cat)) {
    return { spec: "", grade: "A" };
  }
  const specs = CLINICAL_TAXONOMY[cat];
  return { spec: specs[0] ?? "", grade: "A" };
}

function annotationDisplayLabel(ann: Annotation): string {
  if (DRAWABLE_CATEGORIES.includes(ann.category as Category)) {
    return `${ann.category} - ${ann.severity}`;
  }
  return ann.spec ? `${ann.spec} - ${ann.severity}` : ann.severity;
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
    .map((a): Annotation => {
      const ann = a as Annotation & { severity: unknown };
      const points = Array.isArray(ann.points)
        ? ann.points.filter(
            (p) =>
              p &&
              typeof p === "object" &&
              typeof p.x === "number" &&
              typeof p.y === "number" &&
              Number.isFinite(p.x) &&
              Number.isFinite(p.y)
          )
        : [];
      const type: Annotation["type"] = ann.type === "line" ? "line" : "path";
      return {
        id: ann.id,
        imageIndex: ann.imageIndex,
        category: ann.category,
        spec: ann.spec,
        severity: normalizeSeverityGrade(ann.severity, "A"),
        color: ann.color,
        type,
        points,
        userId: typeof ann.userId === "string" ? ann.userId : undefined,
      };
    })
    .filter((ann) => ann.points.length >= (ann.type === "line" ? 2 : 3));
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

interface Annotation extends AnnotatorShape {
  userId?: string;
}

type AnnotatorImageLock = {
  userId: string;
  userName: string;
  expiresAt: string;
};

type SessionUser = { id: string; name: string; isAnnotatorAdmin?: boolean };

function AnnotatorAdminBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300 ${className}`}
    >
      Admin
    </span>
  );
}

type PersistedImage = {
  id: number;
  fileName: string;
  mimeType: string;
  imageUrl: string | null;
  /** Legacy rows only */
  dataUri?: string | null;
  sortOrder: number;
};

function persistedImageSrc(img: PersistedImage): string {
  return img.imageUrl || img.dataUri || "";
}

/**
 * Small WebP variant for the thumbnail strip. Only API-served files support
 * resize; data URIs (base64) are returned as-is.
 */
function thumbnailSrc(src: string, width = 200): string {
  if (!src.startsWith("/api/annotator/files/")) return src;
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}w=${width}`;
}

let annotationIdCounter = 0;

function nextAnnotationId(userId: string): string {
  return `ann-${userId.slice(0, 8)}-${++annotationIdCounter}`;
}

function parseAnnotatorSyncTs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function sparsePerImagePayload(
  perImageByCategory: Record<number, Partial<Record<Category, Partial<CategoryEntry>>>>,
  touched: Set<number>
): Record<string, Partial<Record<Category, Partial<CategoryEntry>>>> {
  const out: Record<string, Partial<Record<Category, Partial<CategoryEntry>>>> = {};
  for (const idx of touched) {
    const patch = perImageByCategory[idx];
    if (patch && Object.keys(patch).length > 0) {
      out[String(idx)] = patch;
    }
  }
  return out;
}

function cloneAnnotations(list: Annotation[]): Annotation[] {
  return list.map((a) => ({
    ...a,
    points: a.points.map((p) => ({ ...p })),
  }));
}

/** Keep unsaved local drawings while dropping shapes removed on the server (admin delete). */
function reconcileLocalAnnotationsWithServer(
  local: Annotation[],
  server: Annotation[],
  prevServerIds: Set<string>
): Annotation[] {
  const serverIds = new Set(server.map((a) => a.id));
  const removedOnServer = new Set([...prevServerIds].filter((id) => !serverIds.has(id)));
  const serverById = new Map(server.map((a) => [a.id, a]));
  const localOnly = local.filter((a) => !prevServerIds.has(a.id));

  const merged: Annotation[] = server.map((a) => ({ ...a }));
  const seen = new Set(serverIds);

  for (const ann of local) {
    if (removedOnServer.has(ann.id) || seen.has(ann.id)) continue;
    merged.push(ann);
    seen.add(ann.id);
  }

  for (const ann of localOnly) {
    if (removedOnServer.has(ann.id) || seen.has(ann.id)) continue;
    merged.push(ann);
    seen.add(ann.id);
  }

  for (let i = 0; i < merged.length; i++) {
    const fromServer = serverById.get(merged[i]!.id);
    if (fromServer) merged[i] = { ...fromServer };
  }

  return merged;
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
  const thumbStripRef = useRef<HTMLDivElement>(null);
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
  /** Annotators' merged grades - admin review only (same logic as export). */
  const [mergedPerImageByCategory, setMergedPerImageByCategory] = useState<
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
    intentionalShapeRemovalRef.current = true;
    setAnnotationHistory((ah) => ({
      ...ah,
      index: Math.max(0, ah.index - 1),
    }));
  }, []);

  const redoAnnotation = useCallback(() => {
    intentionalShapeRemovalRef.current = true;
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
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(true);
  const [lastPersistMessage, setLastPersistMessage] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [imageReady, setImageReady] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<
    Record<number, { width: number; height: number }>
  >({});
  const saveDirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const lastPersistedRef = useRef<string | null>(null);
  const touchedImagesRef = useRef<Set<number>>(new Set());
  // True once the user intentionally removes shapes (delete/eraser/undo), which
  // is the only case where saving an empty shape list is allowed to overwrite
  // non-empty server data. A bad hydration leaves this false, so a stray empty
  // autosave can never silently wipe saved annotations.
  const intentionalShapeRemovalRef = useRef(false);
  const prevImageIndexRef = useRef<number | null>(null);
  const lastServerUserSyncAtRef = useRef<string | null>(null);
  const lastPeerSyncSnapshotRef = useRef<string>("");
  const currentIndexRef = useRef(0);
  const shapesAtLastServerSyncRef = useRef<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [imageLocks, setImageLocks] = useState<Record<string, AnnotatorImageLock>>({});
  const [peerAnnotations, setPeerAnnotations] = useState<Annotation[]>([]);
  const [peerImageIndices, setPeerImageIndices] = useState<Set<number>>(new Set());
  const [collabMessage, setCollabMessage] = useState<string>("");

  React.useEffect(() => {
    const dim = imageDimensions[currentIndex];
    if (dim) {
      setImgNatural({ w: dim.width, h: dim.height });
      setImageReady(true);
    } else {
      setImgNatural(null);
      setImageReady(false);
    }
  }, [currentIndex, images, imageDimensions]);

  React.useEffect(() => {
    if (isHydrating || isLoadingAnnotations) {
      lastPersistedRef.current = null;
      return;
    }
    const snap = JSON.stringify({ perImageByCategory, annotations });
    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = snap;
      return;
    }
    if (lastPersistedRef.current !== snap) {
      saveDirtyRef.current = true;
      setSaveStatus((s) => (s === "saving" ? s : "dirty"));
    }
  }, [isHydrating, isLoadingAnnotations, perImageByCategory, annotations]);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveDirtyRef.current || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  React.useEffect(() => {
    if (!DRAWABLE_CATEGORIES.includes(activeCategory) && (activeTool === "path" || activeTool === "line")) {
      setActiveTool("eraser");
    }
  }, [activeCategory, activeTool]);

  React.useEffect(() => {
    const el = thumbStripRef.current?.querySelector(
      `[data-thumb-index="${currentIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  React.useEffect(() => {
    let isMounted = true;

    const applyPersistedState = (
      persistedState: Record<string, unknown>,
      nextMeta: { name: string }[],
      includeAnnotations: boolean
    ) => {
      if (persistedState.currentUser) {
        setCurrentUser(persistedState.currentUser as SessionUser);
      }
      if (persistedState.imageLocks) {
        setImageLocks(persistedState.imageLocks as Record<string, AnnotatorImageLock>);
      }
      if (persistedState.peerAnnotations) {
        setPeerAnnotations(
          migrateAnnotations(persistedState.peerAnnotations) as Annotation[]
        );
      }
      if (Array.isArray(persistedState.peerImageIndices)) {
        setPeerImageIndices(
          new Set(
            (persistedState.peerImageIndices as number[]).filter((n) => Number.isFinite(n))
          )
        );
      }
      setPerImageByCategory(
        migratePerImageByCategory(
          (persistedState.perImageByCategory ?? {}) as Parameters<
            typeof migratePerImageByCategory
          >[0]
        )
      );
      if (persistedState.mergedPerImageByCategory) {
        setMergedPerImageByCategory(
          migratePerImageByCategory(
            persistedState.mergedPerImageByCategory as Parameters<
              typeof migratePerImageByCategory
            >[0]
          )
        );
      }
      if (!includeAnnotations) return;

      const persistedAnnotations = reconcileAnnotationsForImageSet(
        migrateAnnotations(persistedState.annotations),
        [],
        nextMeta
      );
      setAnnotationHistory({
        snapshots: [cloneAnnotations(persistedAnnotations)],
        index: 0,
      });
      shapesAtLastServerSyncRef.current = new Set(persistedAnnotations.map((ann) => ann.id));
      lastServerUserSyncAtRef.current =
        typeof persistedState.userSyncedAt === "string" ? persistedState.userSyncedAt : null;
      const maxCounter = persistedAnnotations.reduce((acc, ann) => {
        const match = String(ann.id).match(/-(\d+)$/);
        const idNum = match ? Number.parseInt(match[1], 10) : Number.NaN;
        return Number.isFinite(idNum) ? Math.max(acc, idNum) : acc;
      }, 0);
      annotationIdCounter = Math.max(annotationIdCounter, maxCounter);
    };

    const loadInitialData = async () => {
      try {
        // Fast path: image list + labels/locks only (no multi-MB shape JSON).
        const [imagesRes, hydrateRes] = await Promise.all([
          fetch("/api/annotator/images", { cache: "no-store" }),
          fetch("/api/annotator/state?hydrate=1", { cache: "no-store" }),
        ]);
        const imagesJson = await imagesRes.json();
        const hydrateJson = await hydrateRes.json();
        if (!isMounted) return;

        const persistedImages = (imagesJson.images ?? []) as PersistedImage[];
        let activeImages = persistedImages;

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

        const nextMeta = activeImages.map((img) => ({ name: img.fileName }));
        setImages(activeImages.map((img) => persistedImageSrc(img)));
        setImageMeta(nextMeta);
        setCurrentIndex(0);

        if (hydrateJson.state) {
          applyPersistedState(hydrateJson.state, nextMeta, false);
        }

        // Show UI immediately - annotations load in background.
        setIsHydrating(false);
        saveDirtyRef.current = false;
        lastPersistedRef.current = null;
        setSaveStatus("saved");

        // Thumbnail hints: load peer image indices once (not on every image switch).
        void fetch("/api/annotator/state?peers=1&peerIndices=1", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            if (!isMounted || !json?.state?.peerImageIndices) return;
            setPeerImageIndices(
              new Set(
                (json.state.peerImageIndices as number[]).filter((n) => Number.isFinite(n))
              )
            );
          })
          .catch(() => undefined);

        const shapesRes = await fetch("/api/annotator/state", { cache: "no-store" });
        if (!isMounted) return;
        const shapesJson = await shapesRes.json().catch(() => ({}));
        if (shapesJson.state) {
          applyPersistedState(shapesJson.state, nextMeta, true);
        }
      } catch (err) {
        console.error("Failed to hydrate annotator data", err);
      } finally {
        if (isMounted) {
          setIsHydrating(false);
          setIsLoadingAnnotations(false);
          saveDirtyRef.current = false;
          lastPersistedRef.current = null;
          setSaveStatus("saved");
        }
      }
    };
    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  const markImageTouched = useCallback((imageIndex: number) => {
    touchedImagesRef.current.add(imageIndex);
  }, []);

  const canEditCurrentImage = React.useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.isAnnotatorAdmin) return true;
    const lock = imageLocks[String(currentIndex)];
    return !lock || lock.userId === currentUser.id;
  }, [currentUser, imageLocks, currentIndex]);

  const refreshMergedLabelsForAdmin = useCallback(async () => {
    if (!currentUser?.isAnnotatorAdmin) return;
    try {
      const res = await fetch("/api/annotator/state?hydrate=1", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.state?.mergedPerImageByCategory) {
        setMergedPerImageByCategory(
          migratePerImageByCategory(
            json.state.mergedPerImageByCategory as Parameters<
              typeof migratePerImageByCategory
            >[0]
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, [currentUser?.isAnnotatorAdmin]);

  React.useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  React.useEffect(() => {
    if (isHydrating || !currentUser || images.length === 0) return;

    const prev = prevImageIndexRef.current;
    if (prev !== null && prev !== currentIndex) {
      void fetch(`/api/annotator/locks?imageIndex=${prev}`, { method: "DELETE" });
    }
    prevImageIndexRef.current = currentIndex;

    let cancelled = false;
    const acquire = async () => {
      const res = await fetch("/api/annotator/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIndex: currentIndex, action: "acquire" }),
      });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (json.imageLocks) setImageLocks(json.imageLocks);
      if (res.status === 409 && json.lock && !currentUser?.isAnnotatorAdmin) {
        setCollabMessage(`View only - ${json.lock.userName} is annotating this image`);
      } else {
        setCollabMessage("");
      }
    };
    void acquire();

    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentUser, images.length, isHydrating]);

  // Load peer shapes for the image you're viewing (lightweight, per-image instead of full history).
  React.useEffect(() => {
    if (isHydrating || !currentUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/annotator/state?peers=1&imageIndex=${currentIndex}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.state?.peerAnnotations) {
          setPeerAnnotations(migrateAnnotations(json.state.peerAnnotations) as Annotation[]);
        }
        if (Array.isArray(json.state?.peerImageIndices)) {
          setPeerImageIndices(
            new Set((json.state.peerImageIndices as number[]).filter((n) => Number.isFinite(n)))
          );
        }
      } catch {
        /* keep existing peer view on error */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentUser, isHydrating]);

  React.useEffect(() => {
    if (!canEditCurrentImage || !currentUser) return;
    const timer = window.setInterval(() => {
      void fetch("/api/annotator/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIndex: currentIndex, action: "heartbeat" }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.imageLocks) setImageLocks(json.imageLocks);
        })
        .catch(() => undefined);
    }, ANNOTATOR_LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [canEditCurrentImage, currentIndex, currentUser]);

  React.useEffect(() => {
    if (isHydrating || !currentUser) return;

    const applyServerAnnotations = (
      serverAnnotations: Annotation[],
      serverSyncAt: string
    ) => {
      const prevServerIds = shapesAtLastServerSyncRef.current;
      const serverIds = new Set(serverAnnotations.map((a) => a.id));
      const removedOnServer = [...prevServerIds].filter((id) => !serverIds.has(id));

      if (removedOnServer.length > 0) {
        setAnnotationHistory((ah) => {
          const cur = ah.snapshots[ah.index] ?? [];
          const next = reconcileLocalAnnotationsWithServer(
            cur,
            serverAnnotations,
            prevServerIds
          );
          if (next.length !== cur.length) {
            intentionalShapeRemovalRef.current = true;
          }
          return {
            snapshots: [...ah.snapshots.slice(0, ah.index + 1), cloneAnnotations(next)],
            index: ah.index + 1,
          };
        });
      } else if (!saveDirtyRef.current && !saveInFlightRef.current) {
        const nextAnnotations = cloneAnnotations(serverAnnotations);
        setAnnotationHistory({
          snapshots: [nextAnnotations],
          index: 0,
        });
        lastPersistedRef.current = JSON.stringify({
          perImageByCategory,
          annotations: nextAnnotations,
        });
      }

      shapesAtLastServerSyncRef.current = serverIds;
      lastServerUserSyncAtRef.current = serverSyncAt;
    };

    const timer = window.setInterval(async () => {
      // Never apply a poll while local edits are pending or a save is in flight -
      // stale responses were overwriting freshly saved annotations.
      if (saveDirtyRef.current || saveInFlightRef.current) return;
      try {
        const res = await fetch("/api/annotator/state?sync=1", { cache: "no-store" });
        if (!res.ok) return;
        if (saveDirtyRef.current || saveInFlightRef.current) return;
        const json = await res.json();
        if (json.state?.imageLocks) setImageLocks(json.state.imageLocks);

        const serverSyncAt =
          typeof json.state?.userSyncedAt === "string" ? json.state.userSyncedAt : null;
        const serverTs = parseAnnotatorSyncTs(serverSyncAt);
        const localTs = parseAnnotatorSyncTs(lastServerUserSyncAtRef.current);

        const peerSnapshot = JSON.stringify(json.state?.peerSyncAt ?? {});
        const peersChanged = peerSnapshot !== lastPeerSyncSnapshotRef.current;

        const imgIdx = currentIndexRef.current;

        if (serverSyncAt && serverTs > localTs) {
          // My own state changed on the server (e.g. my save landed, or admin edit).
          // Fetch my shapes + only the current image's peers - never full peer history.
          const fullRes = await fetch(
            `/api/annotator/state?imageIndex=${imgIdx}`,
            { cache: "no-store" }
          );
          if (fullRes.ok && !saveDirtyRef.current && !saveInFlightRef.current) {
            const fullJson = await fullRes.json();
            const fullSyncAt =
              typeof fullJson.state?.userSyncedAt === "string"
                ? fullJson.state.userSyncedAt
                : serverSyncAt;
            const serverAnnotations = migrateAnnotations(fullJson.state?.annotations ?? []);
            applyServerAnnotations(serverAnnotations, fullSyncAt);
            if (fullJson.state?.peerAnnotations) {
              setPeerAnnotations(
                migrateAnnotations(fullJson.state.peerAnnotations) as Annotation[]
              );
            }
            if (fullJson.state?.mergedPerImageByCategory) {
              setMergedPerImageByCategory(
                migratePerImageByCategory(
                  fullJson.state.mergedPerImageByCategory as Parameters<
                    typeof migratePerImageByCategory
                  >[0]
                )
              );
            }
            if (Array.isArray(fullJson.state?.peerImageIndices)) {
              setPeerImageIndices(
                new Set(
                  (fullJson.state.peerImageIndices as number[]).filter((n) =>
                    Number.isFinite(n)
                  )
                )
              );
            }
            lastPeerSyncSnapshotRef.current = JSON.stringify(
              fullJson.state?.peerSyncAt ?? json.state?.peerSyncAt ?? {}
            );
            return;
          }
        }

        if (peersChanged && !saveDirtyRef.current && !saveInFlightRef.current) {
          const peerRes = await fetch(
            `/api/annotator/state?peers=1&imageIndex=${imgIdx}`,
            { cache: "no-store" }
          );
          if (peerRes.ok) {
            const peerJson = await peerRes.json();
            if (peerJson.state?.peerAnnotations) {
              setPeerAnnotations(
                migrateAnnotations(peerJson.state.peerAnnotations) as Annotation[]
              );
            }
            if (Array.isArray(peerJson.state?.peerImageIndices)) {
              setPeerImageIndices(
                new Set(
                  (peerJson.state.peerImageIndices as number[]).filter((n) =>
                    Number.isFinite(n)
                  )
                )
              );
            }
            lastPeerSyncSnapshotRef.current = JSON.stringify(
              peerJson.state?.peerSyncAt ?? json.state?.peerSyncAt ?? {}
            );
            if (currentUser?.isAnnotatorAdmin) {
              void refreshMergedLabelsForAdmin();
            }
          }
        }
      } catch {
        /* ignore poll errors */
      }
    }, ANNOTATOR_STATE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isHydrating, currentUser, perImageByCategory, refreshMergedLabelsForAdmin]);

  React.useEffect(() => {
    const release = () => {
      if (prevImageIndexRef.current === null) return;
      void fetch(`/api/annotator/locks?imageIndex=${prevImageIndexRef.current}`, {
        method: "DELETE",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, []);

  React.useEffect(() => {
    if (isHydrating || isLoadingAnnotations || !saveDirtyRef.current || !canEditCurrentImage) return;
    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      saveInFlightRef.current = true;
      try {
        const res = await fetch("/api/annotator/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perImageByCategory: sparsePerImagePayload(
              perImageByCategory,
              touchedImagesRef.current
            ),
            annotations,
            clientSyncedAt: lastServerUserSyncAtRef.current ?? undefined,
            // Only permit overwriting saved shapes with an empty list when the
            // emptiness is the result of an explicit removal this session.
            allowEmptyAnnotations:
              annotations.length === 0 && intentionalShapeRemovalRef.current,
          }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const json = await res.json().catch(() => ({}));
        if (json.imageLocks) setImageLocks(json.imageLocks);
        if (typeof json.userSyncedAt === "string") {
          lastServerUserSyncAtRef.current = json.userSyncedAt;
        }
        shapesAtLastServerSyncRef.current = new Set(annotations.map((a) => a.id));
        const snap = JSON.stringify({ perImageByCategory, annotations });
        lastPersistedRef.current = snap;
        saveDirtyRef.current = false;
        setSaveStatus("saved");
        setLastPersistMessage(`Saved ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error("Failed to save annotator state", err);
        setSaveStatus("error");
        setLastPersistMessage("Save failed - retry by making a small edit");
      } finally {
        saveInFlightRef.current = false;
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isHydrating, isLoadingAnnotations, perImageByCategory, annotations, canEditCurrentImage]);

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

  const isAnnotatorAdmin = currentUser?.isAnnotatorAdmin === true;

  const categoryState = React.useMemo(() => {
    const base = fullDefaults();
    const mergedPatch = isAnnotatorAdmin ? (mergedPerImageByCategory[currentIndex] ?? {}) : {};
    const ownPatch = perImageByCategory[currentIndex] ?? {};
    const patch = isAnnotatorAdmin ? { ...mergedPatch, ...ownPatch } : ownPatch;
    const out = { ...base };
    for (const c of ALL_CATEGORIES) {
      if (patch[c]) out[c] = { ...base[c], ...normalizeCategoryEntry(patch[c]!) };
    }
    return out;
  }, [perImageByCategory, mergedPerImageByCategory, currentIndex, isAnnotatorAdmin]);

  const syncShapesForCategory = useCallback(
    (
      imageIndex: number,
      cat: Category,
      patch: { spec?: string; grade?: SeverityGrade }
    ) => {
      if (patch.spec === undefined && patch.grade === undefined) return;
      commitAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.imageIndex !== imageIndex || ann.category !== cat) return ann;
          const next = { ...ann };
          if (patch.grade !== undefined) next.severity = patch.grade;
          if (
            patch.spec !== undefined &&
            !DRAWABLE_CATEGORIES.includes(cat)
          ) {
            next.spec = patch.spec;
          }
          return next;
        })
      );
    },
    [commitAnnotations]
  );

  const setCategoryGrade = useCallback(
    (imageIndex: number, cat: Category, grade: SeverityGrade) => {
      if (imageIndex === currentIndex && !canEditCurrentImage) return;
      markImageTouched(imageIndex);
      setPerImageByCategory((prev) => {
        const cur = prev[imageIndex] ?? {};
        const prevEntry = { ...defaultEntry(cat), ...cur[cat] };
        return {
          ...prev,
          [imageIndex]: { ...cur, [cat]: { ...prevEntry, grade } },
        };
      });
      syncShapesForCategory(imageIndex, cat, { grade });
    },
    [syncShapesForCategory, currentIndex, canEditCurrentImage, markImageTouched]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (images.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, goPrev, goNext]);

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
      if (images.length === 0 || !imageReady || !canEditCurrentImage) return;
      const pt = getNormalizedPoint(e, canvasRef.current);
      if (!pt) return;

      const canDraw = DRAWABLE_CATEGORIES.includes(activeCategory);
      if ((activeTool === "path" || activeTool === "line") && canDraw) {
        setIsDrawing(true);
        setCurrentStrokePoints([pt]);
      }
      // Eraser: handled by shape onClick
    },
    [images.length, activeTool, activeCategory, imageReady, canEditCurrentImage]
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
    if (!isDrawing || !canEditCurrentImage || !currentUser) return;
    if (!DRAWABLE_CATEGORIES.includes(activeCategory)) {
      setIsDrawing(false);
      setCurrentStrokePoints([]);
      return;
    }
    const { grade } = categoryState[activeCategory];
    markImageTouched(currentIndex);
    if (activeTool === "path" && currentStrokePoints.length >= 3) {
      const color = CATEGORY_COLORS[activeCategory] ?? "rgb(156, 163, 175)";
      commitAnnotations((prev) => [
        ...prev,
        {
          id: nextAnnotationId(currentUser.id),
          imageIndex: currentIndex,
          category: activeCategory,
          spec: "",
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
          id: nextAnnotationId(currentUser.id),
          imageIndex: currentIndex,
          category: activeCategory,
          spec: "",
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
    canEditCurrentImage,
    currentUser,
    markImageTouched,
  ]);

  React.useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);

    const form = new FormData();
    for (const f of list) {
      form.append("files", f);
    }

    try {
      const res = await fetch("/api/annotator/images", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const json = await res.json();
      const created = (json.images ?? []) as PersistedImage[];
      const addedMeta = created.map((img) => ({ name: img.fileName }));
      const addedSrc = created.map((img) => persistedImageSrc(img));
      setImages((prev) => [...prev, ...addedSrc]);
      setImageMeta((prev) => {
        const nextMeta = [...prev, ...addedMeta];
        setAnnotationHistory((ah) => {
          const reconciled = reconcileAnnotationsForImageSet(
            ah.snapshots[ah.index],
            prev,
            nextMeta
          );
          const snapshots = ah.snapshots.slice(0, ah.index + 1);
          snapshots.push(cloneAnnotations(reconciled));
          return { snapshots, index: snapshots.length - 1 };
        });
        return nextMeta;
      });
      setLastPersistMessage(`Uploaded ${created.length} image(s)`);
    } catch (err) {
      console.error("Failed to upload images", err);
      setLastPersistMessage("Image upload failed");
    }
    e.target.value = "";
  };

  const exportAnnotationsJson = useCallback(async () => {
    if (images.length === 0) return;

    let mergedLabels: Record<string, Record<string, CategoryEntry>> = {};
    let mergedAnnotations: Annotation[] = [...annotations];
    try {
      const res = await fetch("/api/annotator/state?merged=1", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        mergedLabels = (json.state?.perImageByCategory ?? {}) as Record<
          string,
          Record<string, CategoryEntry>
        >;
        const remote = migrateAnnotations(json.state?.annotations ?? []);
        const mineIds = new Set(annotations.map((a) => a.id));
        mergedAnnotations = [
          ...annotations,
          ...remote.filter((a) => !mineIds.has(a.id)),
        ];
      }
    } catch {
      /* fall back to local only */
    }

    const labelsByImageIndex: Record<
      string,
      Record<Category, CategoryEntry & { score: number }>
    > = {};
    for (let i = 0; i < images.length; i++) {
      const base = fullDefaults();
      const patch = mergedLabels[String(i)] ?? perImageByCategory[i] ?? {};
      const merged = { ...base };
      for (const c of ALL_CATEGORIES) {
        const entry = patch[c];
        if (entry) merged[c] = normalizeCategoryEntry({ ...base[c], ...entry });
      }
      labelsByImageIndex[String(i)] = Object.fromEntries(
        ALL_CATEGORIES.map((c) => [
          c,
          {
            spec: merged[c].spec,
            grade: merged[c].grade,
            score: severityGradeToScore(merged[c].grade),
          },
        ])
      ) as Record<Category, CategoryEntry & { score: number }>;
    }

    const exportAnnotations = cloneAnnotations(mergedAnnotations).map((ann) => ({
      ...ann,
      score: severityGradeToScore(ann.severity),
    }));

    const payload = {
      schemaVersion: 2,
      app: "skinnfit-clinical-annotator",
      exportedAt: new Date().toISOString(),
      note:
        "Images are not embedded. Match `images[].fileName` to files on disk. Points are normalized 0-1 vs image width/height. `grade` is A-E (A=least severe); `score` is numeric 1-5 for eval pipelines. Merged export includes all collaborators' shapes and labels.",
      imageCount: images.length,
      images: images.map((_, i) => ({
        index: i,
        fileName: imageMeta[i]?.name ?? `image-${i + 1}`,
        imageWidth: imageDimensions[i]?.width ?? null,
        imageHeight: imageDimensions[i]?.height ?? null,
      })),
      labelsByImageIndex,
      annotations: exportAnnotations,
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
  }, [images, imageMeta, perImageByCategory, annotations, imageDimensions]);

  const deleteAnnotation = useCallback(
    (id: string, ownerUserId?: string) => {
      if (!canEditCurrentImage) return;

      const isPeerDelete =
        isAnnotatorAdmin &&
        ownerUserId &&
        currentUser &&
        ownerUserId !== currentUser.id;

      if (isPeerDelete) {
        setPeerAnnotations((prev) => prev.filter((a) => a.id !== id));
        void (async () => {
          try {
            const res = await fetch("/api/annotator/state", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deletePeerShape: { shapeId: id, ownerUserId },
                imageIndex: currentIndex,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(json.error ?? res.status));
            if (json.peerAnnotations) {
              setPeerAnnotations(migrateAnnotations(json.peerAnnotations) as Annotation[]);
            }
            if (Array.isArray(json.peerImageIndices)) {
              setPeerImageIndices(
                new Set((json.peerImageIndices as number[]).filter((n) => Number.isFinite(n)))
              );
            }
            setLastPersistMessage(`Deleted peer annotation · ${new Date().toLocaleTimeString()}`);
          } catch (err) {
            console.error("Failed to delete peer annotation", err);
            setLastPersistMessage("Failed to delete peer annotation - refresh to resync");
            const stateRes = await fetch(
              `/api/annotator/state?peers=1&imageIndex=${currentIndex}`,
              { cache: "no-store" }
            );
            const stateJson = await stateRes.json().catch(() => ({}));
            if (stateJson.state?.peerAnnotations) {
              setPeerAnnotations(
                migrateAnnotations(stateJson.state.peerAnnotations) as Annotation[]
              );
            }
          }
        })();
        return;
      }

      markImageTouched(currentIndex);
      intentionalShapeRemovalRef.current = true;
      commitAnnotations((prev) => prev.filter((a) => a.id !== id));
    },
    [
      commitAnnotations,
      canEditCurrentImage,
      currentIndex,
      markImageTouched,
      isAnnotatorAdmin,
      currentUser,
    ]
  );

  const canModifyAnnotation = useCallback(
    (ann: Annotation) => {
      if (!currentUser) return true;
      if (ann.userId && ann.userId !== currentUser.id) {
        return isAnnotatorAdmin;
      }
      return true;
    },
    [currentUser, isAnnotatorAdmin]
  );

  const handleShapeClick = useCallback(
    (e: React.MouseEvent, ann: Annotation) => {
      e.stopPropagation();
      if (activeTool === "eraser" && canModifyAnnotation(ann)) {
        deleteAnnotation(ann.id, ann.userId);
      }
    },
    [activeTool, deleteAnnotation, canModifyAnnotation]
  );

  const myCurrentAnnotations = annotations.filter((a) => a.imageIndex === currentIndex);
  const peerCurrentAnnotations = peerAnnotations.filter((a) => a.imageIndex === currentIndex);
  const currentAnnotations = [...myCurrentAnnotations, ...peerCurrentAnnotations];
  const activeIsDrawable = DRAWABLE_CATEGORIES.includes(activeCategory);
  const canDrawOnImage = imageReady && images.length > 0 && canEditCurrentImage;
  const { grade: activeGrade } = categoryState[activeCategory];

  const displaySize = React.useMemo(() => {
    if (!imgNatural) return null;
    return {
      w: Math.max(1, Math.round(imgNatural.w * imageZoom)),
      h: Math.max(1, Math.round(imgNatural.h * imageZoom)),
    };
  }, [imgNatural, imageZoom]);

  const imagesWithWork = React.useMemo(() => {
    const set = new Set<number>();
    for (const ann of annotations) set.add(ann.imageIndex);
    for (const ann of peerAnnotations) set.add(ann.imageIndex);
    // Peer work on images we haven't opened (small index list from the server).
    for (const idx of peerImageIndices) set.add(idx);
    for (const idx of Object.keys(perImageByCategory)) {
      const n = Number(idx);
      if (Number.isFinite(n) && Object.keys(perImageByCategory[n] ?? {}).length > 0) {
        set.add(n);
      }
    }
    return set;
  }, [annotations, peerAnnotations, peerImageIndices, perImageByCategory]);

  const activeLockCount = React.useMemo(
    () => Object.keys(imageLocks).length,
    [imageLocks]
  );

  const renderThumbnailButtons = (compact = false) =>
    images.map((src, i) => {
      const isActive = i === currentIndex;
      const hasWork = imagesWithWork.has(i);
      const lock = imageLocks[String(i)];
      const lockedByOther = Boolean(lock && currentUser && lock.userId !== currentUser.id);
      const lockedByMe = Boolean(lock && currentUser && lock.userId === currentUser.id);
      const label = imageMeta[i]?.name ?? `Image ${i + 1}`;
      return (
        <button
          key={`thumb-${i}-${src.slice(0, 24)}`}
          type="button"
          data-thumb-index={i}
          onClick={() => setCurrentIndex(i)}
          title={
            lockedByOther
              ? `${label} - ${lock!.userName} is annotating`
              : lockedByMe
                ? `${label} - you are annotating`
                : label
          }
          className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
            compact ? "h-14 w-14" : "aspect-[3/4] w-full"
          } ${
            isActive
              ? "border-[#DF9DA4] ring-2 ring-[#1E1B31]/40"
              : "border-slate-300 hover:border-teal-400 dark:border-zinc-600 dark:hover:border-[#DF9DA4]"
          }`}
        >
          <img
            src={thumbnailSrc(src, compact ? 120 : 220)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <span
            className={`absolute bottom-0 left-0 right-0 bg-black/65 px-1 py-0.5 text-center font-mono text-[10px] font-semibold text-white ${
              compact ? "text-[9px]" : ""
            }`}
          >
            {i + 1}
          </span>
          {hasWork ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-teal-400 ring-1 ring-black/40" />
          ) : null}
          {lockedByOther ? (
            <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 text-[8px] font-bold text-black">
              BUSY
            </span>
          ) : null}
          {lockedByMe ? (
            <span className="absolute left-1 top-1 rounded bg-[#F8EDEE]0/90 px-1 text-[8px] font-bold text-black">
              YOU
            </span>
          ) : null}
        </button>
      );
    });

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top Nav */}
      <nav className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-4">
          <Link
            href="/clinic"
            className="text-slate-500 transition-colors hover:text-[#F8EDEE]0 dark:text-zinc-500 dark:hover:text-[#DF9DA4]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Skinnfit Clinical Annotator
          </h1>
          {isAnnotatorAdmin ? <AnnotatorAdminBadge /> : null}
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
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#DF9DA4]"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#DF9DA4]"
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
            title="Download all labels and shapes as JSON (images not included - keep your files)"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F8EDEE]0 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-teal-400"
          >
            <Upload className="h-4 w-4" />
            Upload Images
          </button>
        </div>
      </nav>
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-1.5 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {isHydrating ? (
          lastPersistMessage || "Loading annotator…"
        ) : isLoadingAnnotations ? (
          "Loading your annotations…"
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span
              className={
                saveStatus === "error"
                  ? "font-medium text-red-600 dark:text-red-400"
                  : saveStatus === "dirty"
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : saveStatus === "saving"
                      ? "font-medium text-[#1E1B31] dark:text-[#DF9DA4]"
                      : "text-slate-600 dark:text-zinc-400"
              }
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "dirty" && "Unsaved changes…"}
              {saveStatus === "saved" && "All changes saved"}
              {saveStatus === "error" && "Save failed"}
              {saveStatus === "idle" && "Ready"}
            </span>
            {!imageReady && images.length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">Loading image…</span>
            ) : null}
            {lastPersistMessage ? (
              <span className="text-slate-500 dark:text-zinc-500">· {lastPersistMessage}</span>
            ) : null}
            {currentUser ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-500">
                · {currentUser.name}
                {currentUser.isAnnotatorAdmin ? <AnnotatorAdminBadge /> : null}
                {activeLockCount > 0 ? ` · ${activeLockCount} active` : ""}
              </span>
            ) : null}
            {collabMessage && !isAnnotatorAdmin ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">· {collabMessage}</span>
            ) : isAnnotatorAdmin && collabMessage ? (
              <span className="text-slate-500 dark:text-zinc-500">
                · {collabMessage.replace("View only - ", "")} (admin override)
              </span>
            ) : canEditCurrentImage && currentUser ? (
              <span className="text-[#1E1B31] dark:text-[#DF9DA4]">· You can edit this image</span>
            ) : null}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(160px,42vh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[5.75rem_1fr_minmax(360px,26rem)] lg:grid-rows-1">
        {/* Thumbnail strip - desktop */}
        {images.length > 0 ? (
          <aside className="hidden min-h-0 flex-col border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex">
            <div className="shrink-0 border-b border-slate-200 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              {images.length} imgs
            </div>
            <div
              ref={thumbStripRef}
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2"
            >
              {renderThumbnailButtons()}
            </div>
          </aside>
        ) : null}

        {/* Canvas */}
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
                className="text-[#F8EDEE]0 hover:text-[#242A5F] dark:text-[#DF9DA4] dark:hover:text-[#DF9DA4]"
              >
                Click to upload images
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex w-full gap-2 overflow-x-auto pb-1 lg:hidden">
                {renderThumbnailButtons(true)}
              </div>

              <div className="sticky top-0 z-30 mb-3 flex w-full max-w-md flex-wrap items-center justify-center gap-1.5 self-center rounded-xl border-2 border-slate-400 bg-white px-3 py-2.5 shadow-md ring-1 ring-slate-900/10 dark:border-zinc-500 dark:bg-zinc-800 dark:ring-white/10">
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))}
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-[#DF9DA4] hover:bg-[#F8EDEE] hover:text-[#1E1B31] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
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
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-[#DF9DA4] hover:bg-[#F8EDEE] hover:text-[#1E1B31] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4 shrink-0 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900 transition-colors hover:border-[#DF9DA4] hover:bg-[#F8EDEE] hover:text-[#1E1B31] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-950/80 dark:hover:text-teal-200"
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
                      setImageDimensions((prev) => ({
                        ...prev,
                        [currentIndex]: {
                          width: t.naturalWidth,
                          height: t.naturalHeight,
                        },
                      }));
                      setImageReady(true);
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
                    {currentAnnotations.map((ann) => {
                      const editable = canModifyAnnotation(ann);
                      const isPeer = Boolean(ann.userId && currentUser && ann.userId !== currentUser.id);
                      return (
                      <g
                        key={ann.id}
                        style={{
                          cursor: editable && activeTool === "eraser" ? "pointer" : "default",
                          pointerEvents: editable ? "painted" : "none",
                          opacity: 1,
                        }}
                        onClick={(e) => {
                          if (!editable) return;
                          handleShapeClick(e as unknown as React.MouseEvent, ann);
                        }}
                      >
                        {ann.type === "path" ? (
                          <path
                            d={pointsToPathD(ann.points, true)}
                            fill={ann.color}
                            fillOpacity={0.3}
                            stroke={ann.color}
                            strokeWidth={0.005}
                            strokeDasharray={isPeer ? "0.012 0.008" : undefined}
                            className={editable && activeTool === "eraser" ? "hover:opacity-80" : ""}
                          />
                        ) : (
                          <polyline
                            points={pointsToPolylinePoints(ann.points)}
                            fill="none"
                            stroke={ann.color}
                            strokeWidth={0.005}
                            strokeDasharray={isPeer ? "0.012 0.008" : undefined}
                            className={editable && activeTool === "eraser" ? "hover:opacity-80" : ""}
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
                          {annotationDisplayLabel(ann)}
                        </text>
                      </g>
                    );
                    })}

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
              <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-500">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-200 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Prev
                </button>
                <span>
                  Image{" "}
                  <input
                    type="number"
                    min={1}
                    max={images.length}
                    value={currentIndex + 1}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(n)) return;
                      setCurrentIndex(Math.max(0, Math.min(images.length - 1, n - 1)));
                    }}
                    className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-sm font-semibold text-slate-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    aria-label="Jump to image number"
                  />{" "}
                  of {images.length}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-200 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
                <span className="hidden text-xs text-slate-400 dark:text-zinc-500 sm:inline">
                  · ← → keys · click thumbnails
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - classic layout: tools, category grid, spec (drawable only), score for all */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:border-l lg:border-t-0 lg:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Crosshair className="h-4 w-4 shrink-0 text-[#DF9DA4]" />
            Annotation Tools
          </h2>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTool("path")}
              disabled={images.length === 0 || !activeIsDrawable || !canDrawOnImage}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool === "path"
                  ? "bg-[#F8EDEE]0 text-zinc-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Pencil className="h-4 w-4" />
              Path
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("line")}
              disabled={images.length === 0 || !activeIsDrawable || !canDrawOnImage}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool === "line"
                  ? "bg-[#F8EDEE]0 text-zinc-950"
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
                  ? "bg-[#F8EDEE]0 text-zinc-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Eraser className="h-4 w-4" />
              Eraser
            </button>
          </div>

          <div className="mb-4 space-y-4">
            <div>
              <p className="sr-only">Draw and grade - tap a picture to mark regions on the image</p>
              <div
                className="mb-2 h-1 rounded-full bg-[#F8EDEE]0/80"
                aria-hidden="true"
              />
              <div className="grid grid-cols-2 gap-2.5 auto-rows-[7.75rem]">
                {DRAWABLE_CATEGORIES.map((cat) => (
                  <CategoryPickerButton
                    key={cat}
                    category={cat}
                    isActive={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="sr-only">Score only - tap a picture to set severity without drawing</p>
              <div
                className="mb-2 h-1 rounded-full bg-slate-400/60 dark:bg-zinc-600"
                aria-hidden="true"
              />
              <div className="grid grid-cols-2 gap-2.5 auto-rows-[7.75rem]">
                {SCORE_ONLY_CATEGORIES.map((cat) => (
                  <CategoryPickerButton
                    key={cat}
                    category={cat}
                    isActive={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                  />
                ))}
              </div>
            </div>
          </div>

          {activeIsDrawable ? (
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
              Pick a grade below, then use <strong className="text-slate-800 dark:text-zinc-200">Path</strong> or{" "}
              <strong className="text-slate-800 dark:text-zinc-200">Line</strong> to mark regions on the image.
            </p>
          ) : (
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
              <strong className="text-slate-800 dark:text-zinc-200">Score only</strong> - set severity below. Use{" "}
              <span className="text-[#1E1B31] dark:text-[#DF9DA4]">Draw + grade</span> categories to paint regions on the image.
            </p>
          )}

          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              Severity grade (A-E) · {activeCategory}
            </label>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-zinc-500">
              A = least severe (1), E = most severe (5). Applies to this category on the current image.
            </p>
            {isAnnotatorAdmin ? (
              <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                Admin view: showing annotators&apos; merged grades and scores. Your edits override on
                this image.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {SEVERITY_GRADE_OPTIONS.map(({ grade, score }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={images.length === 0 || !canEditCurrentImage}
                  onClick={() => setCategoryGrade(currentIndex, activeCategory, grade)}
                  title={`Grade ${grade} (score ${score})`}
                  className={`flex h-10 min-w-10 shrink-0 flex-col items-center justify-center rounded-lg px-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    activeGrade === grade
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>{grade}</span>
                  {isAnnotatorAdmin ? (
                    <span className="text-[9px] font-medium leading-none opacity-80">{score}</span>
                  ) : null}
                </button>
              ))}
            </div>
            {isAnnotatorAdmin ? (
              <p className="mt-2 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                Current: {activeGrade} (score {severityGradeToScore(activeGrade)})
              </p>
            ) : null}
          </div>

          <div className="mt-auto border-t border-slate-200 pt-4 dark:border-zinc-800">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              Annotation list
            </label>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {currentAnnotations.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500 dark:text-zinc-500">
                  {!canEditCurrentImage
                    ? collabMessage || "View only on this image - pick another or wait"
                    : canDrawOnImage
                      ? "Use Path or Line on a drawable category to draw on the image"
                      : "Wait for the image to finish loading before drawing"}
                </p>
              ) : (
                currentAnnotations.map((ann) => {
                  const editable = canModifyAnnotation(ann);
                  const isPeer = Boolean(ann.userId && currentUser && ann.userId !== currentUser.id);
                  return (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                        {annotationDisplayLabel(ann)}
                        {isPeer ? " (peer)" : ""}
                        {isAnnotatorAdmin ? ` · ${severityGradeToScore(ann.severity)}` : ""}
                      </p>
                      <p className="truncate text-[10px] text-slate-500 dark:text-zinc-500">
                        {ann.category} ({ann.type})
                      </p>
                    </div>
                    {editable ? (
                    <button
                      type="button"
                      onClick={() => deleteAnnotation(ann.id, ann.userId)}
                      className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-red-500/20 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                      title={isPeer ? "Delete peer annotation (admin)" : "Delete annotation"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    ) : null}
                  </div>
                );
                })
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
                  activeTool === "path" ? "bg-[#F8EDEE]0 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-[#F8EDEE]0 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#DF9DA4]"
                }`}
                onClick={() => setActiveTool("path")}
              >
                <Pencil className="h-4 w-4" />
                Path
              </button>
              <button
                type="button"
                className={`flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs transition-colors ${
                  activeTool === "line" ? "bg-[#F8EDEE]0 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-[#F8EDEE]0 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#DF9DA4]"
                }`}
                onClick={() => setActiveTool("line")}
              >
                <Minus className="h-4 w-4" />
                Line
              </button>
              <button
                type="button"
                className={`flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs transition-colors ${
                  activeTool === "eraser" ? "bg-[#F8EDEE]0 text-zinc-950" : "text-slate-500 hover:bg-slate-200 hover:text-[#F8EDEE]0 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#DF9DA4]"
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
                    className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-[#F8EDEE]0/20 hover:text-[#242A5F] dark:text-zinc-300 dark:hover:text-[#DF9DA4]"
                    onClick={() =>
                      setContextMenu((prev) =>
                        prev ? { ...prev, step: "severity", tempCategory: cat } : null
                      )
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            {contextMenu.step === "severity" && contextMenu.tempCategory && (
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
                {SEVERITY_GRADE_OPTIONS.map(({ grade }) => (
                  <button
                    key={grade}
                    type="button"
                    className="w-full cursor-pointer px-4 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-[#F8EDEE]0/20 hover:text-[#242A5F] dark:text-zinc-300 dark:hover:text-[#DF9DA4]"
                    onClick={() => {
                      const cat = contextMenu.tempCategory as Category;
                      setActiveCategory(cat);
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
                picture. Use zoom buttons or Ctrl/Cmd+scroll on the image to zoom (25%-400%).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">2. Categories:</span>{" "}
                <strong>Draw + grade</strong> lists the four you can annotate on the image (grade + regions only).{" "}
                <strong>Score only</strong> lists the other two (severity grades A-E; A = least severe, E = most severe).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">3. Drawing:</span>{" "}
                Path and Line work only when a drawable category is selected; new strokes use that category&apos;s
                grade.
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">4. Context menu:</span>{" "}
                Right-click the image to pick a drawable category and grade.
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">5. Undo / redo:</span>{" "}
                Top bar - restore or replay the last change to drawn shapes (add or erase).
              </li>
              <li>
                <span className="font-semibold text-slate-900 dark:text-white">6. Save / download:</span>{" "}
                Use <strong>Export JSON</strong> in the top bar. It downloads grades and scores for every image index,
                all drawn shapes (coordinates 0-1 vs image size), and original file names from upload. Pixel images are
                not inside the file - keep those files on disk and match by name/index.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
