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

type PhraseStore = Partial<Record<DoctorCustomSnippetScope, string[]>>;

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
