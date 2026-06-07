const STORAGE_KEY_V2 = "skinfit:doctor-custom-phrases-v2";
const STORAGE_KEY_V1 = "skinfit:doctor-custom-phrases";
const MAX_CUSTOM_PHRASES = 40;
const MAX_PHRASE_LENGTH = 120;

export type DoctorCustomSnippetScope =
  | "routine"
  | "feedback"
  | "visit-treatment"
  | "visit-pre"
  | "visit-post";

type GroupOverride = {
  added: string[];
  removed: string[];
};

type PhraseStore = Partial<Record<DoctorCustomSnippetScope, string[]>> & {
  __groupOverrides?: Record<string, GroupOverride>;
};

function groupOverrideKey(scope: DoctorCustomSnippetScope, groupLabel: string): string {
  return `${scope}::${groupLabel}`;
}

function normalizePhrase(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_PHRASE_LENGTH);
}

function normalizeList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const phrase = normalizePhrase(item);
    if (!phrase || seen.has(phrase.toLowerCase())) continue;
    seen.add(phrase.toLowerCase());
    out.push(phrase);
  }
  return out.slice(0, MAX_CUSTOM_PHRASES);
}

function readStore(): PhraseStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const store: PhraseStore = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (key === "__groupOverrides") {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              const overrides: Record<string, GroupOverride> = {};
              for (const [groupKey, groupValue] of Object.entries(value)) {
                if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) {
                  continue;
                }
                const gv = groupValue as { added?: unknown; removed?: unknown };
                overrides[groupKey] = {
                  added: normalizeList(gv.added),
                  removed: normalizeList(gv.removed),
                };
              }
              if (Object.keys(overrides).length > 0) {
                store.__groupOverrides = overrides;
              }
            }
            continue;
          }
          store[key as DoctorCustomSnippetScope] = normalizeList(value);
        }
        return store;
      }
    }

    const legacyRaw = window.localStorage.getItem(STORAGE_KEY_V1);
    if (legacyRaw) {
      const legacy = normalizeList(JSON.parse(legacyRaw) as unknown);
      if (legacy.length > 0) {
        const migrated: PhraseStore = { routine: legacy };
        writeStore(migrated);
        window.localStorage.removeItem(STORAGE_KEY_V1);
        return migrated;
      }
    }
  } catch {
    return {};
  }
  return {};
}

function writeStore(store: PhraseStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store));
}

export function readDoctorCustomSnippets(scope: DoctorCustomSnippetScope): string[] {
  const store = readStore();
  return store[scope] ?? [];
}

export function addDoctorCustomSnippet(
  scope: DoctorCustomSnippetScope,
  text: string
): string[] {
  const phrase = normalizePhrase(text);
  if (!phrase) return readDoctorCustomSnippets(scope);

  const store = readStore();
  const current = store[scope] ?? [];
  if (current.some((p) => p.toLowerCase() === phrase.toLowerCase())) {
    return current;
  }

  const next = [phrase, ...current].slice(0, MAX_CUSTOM_PHRASES);
  store[scope] = next;
  writeStore(store);
  return next;
}

export function removeDoctorCustomSnippet(
  scope: DoctorCustomSnippetScope,
  text: string
): string[] {
  const target = normalizePhrase(text).toLowerCase();
  if (!target) return readDoctorCustomSnippets(scope);

  const store = readStore();
  const current = store[scope] ?? [];
  const next = current.filter((p) => p.toLowerCase() !== target);
  store[scope] = next;
  writeStore(store);
  return next;
}

function readGroupOverride(
  store: PhraseStore,
  scope: DoctorCustomSnippetScope,
  groupLabel: string
): GroupOverride {
  const key = groupOverrideKey(scope, groupLabel);
  const raw = store.__groupOverrides?.[key];
  return {
    added: normalizeList(raw?.added),
    removed: normalizeList(raw?.removed),
  };
}

function writeGroupOverride(
  store: PhraseStore,
  scope: DoctorCustomSnippetScope,
  groupLabel: string,
  override: GroupOverride
): void {
  const key = groupOverrideKey(scope, groupLabel);
  if (!store.__groupOverrides) store.__groupOverrides = {};
  const added = normalizeList(override.added);
  const removed = normalizeList(override.removed);
  if (added.length === 0 && removed.length === 0) {
    delete store.__groupOverrides[key];
    if (Object.keys(store.__groupOverrides).length === 0) {
      delete store.__groupOverrides;
    }
    return;
  }
  store.__groupOverrides[key] = { added, removed };
}

export function resolveDoctorSnippetGroupItems(
  scope: DoctorCustomSnippetScope,
  groupLabel: string,
  builtInItems: readonly string[]
): string[] {
  const store = readStore();
  const { added, removed } = readGroupOverride(store, scope, groupLabel);
  const removedSet = new Set(removed.map((p) => p.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of builtInItems) {
    const key = item.toLowerCase();
    if (removedSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  for (const item of added) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function addDoctorSnippetToGroup(
  scope: DoctorCustomSnippetScope,
  groupLabel: string,
  builtInItems: readonly string[],
  text: string
): string[] {
  const phrase = normalizePhrase(text);
  if (!phrase) return resolveDoctorSnippetGroupItems(scope, groupLabel, builtInItems);

  const store = readStore();
  const override = readGroupOverride(store, scope, groupLabel);
  const phraseKey = phrase.toLowerCase();
  const builtInMatch = builtInItems.find((p) => p.toLowerCase() === phraseKey);

  if (builtInMatch) {
    override.removed = override.removed.filter((p) => p.toLowerCase() !== phraseKey);
    override.added = override.added.filter((p) => p.toLowerCase() !== phraseKey);
  } else if (!override.added.some((p) => p.toLowerCase() === phraseKey)) {
    override.added = [phrase, ...override.added].slice(0, MAX_CUSTOM_PHRASES);
  }

  writeGroupOverride(store, scope, groupLabel, override);
  writeStore(store);
  return resolveDoctorSnippetGroupItems(scope, groupLabel, builtInItems);
}

export function removeDoctorSnippetFromGroup(
  scope: DoctorCustomSnippetScope,
  groupLabel: string,
  builtInItems: readonly string[],
  text: string
): string[] {
  const target = normalizePhrase(text).toLowerCase();
  if (!target) return resolveDoctorSnippetGroupItems(scope, groupLabel, builtInItems);

  const store = readStore();
  const override = readGroupOverride(store, scope, groupLabel);
  const isBuiltIn = builtInItems.some((p) => p.toLowerCase() === target);

  if (override.added.some((p) => p.toLowerCase() === target)) {
    override.added = override.added.filter((p) => p.toLowerCase() !== target);
  } else if (isBuiltIn) {
    if (!override.removed.some((p) => p.toLowerCase() === target)) {
      const original = builtInItems.find((p) => p.toLowerCase() === target) ?? text;
      override.removed = [...override.removed, original];
    }
  }

  writeGroupOverride(store, scope, groupLabel, override);
  writeStore(store);
  return resolveDoctorSnippetGroupItems(scope, groupLabel, builtInItems);
}
