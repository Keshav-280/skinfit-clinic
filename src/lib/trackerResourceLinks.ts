import type { PatientTrackerResource } from "@/src/lib/patientTrackerReport.types";

/** Stable fallback links when the LLM omits a URL (not used to override LLM picks). */
export const TRACKER_RESOURCE_DEFAULTS = {
  article: {
    title: "How to build a skin care routine",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-routine",
  },
  video: {
    title: "How to apply sunscreen (dermatologist tips)",
    url: "https://www.youtube.com/watch?v=9pg-OybGGCc",
  },
  scanGuide: {
    title: "Weekly skin check-in routine (5-angle method)",
    path: "/dashboard/scan",
  },
  insightChat: {
    title: "Ask kAI in clinic chat",
    path: "/dashboard/chat",
  },
} as const;

const ALLOWED_ARTICLE_HOSTS = new Set([
  "aad.org",
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
]);

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function isAllowedArticleHost(hostname: string): boolean {
  return ALLOWED_ARTICLE_HOSTS.has(normalizeHost(hostname));
}

/** Old hardcoded fallback that pointed at a unrelated music video - never reuse. */
const BLOCKED_YOUTUBE_VIDEO_IDS = new Set(["9pg-OybGGCc"]);
const YOUTUBE_VIDEO_ID = /^[\w-]{6,12}$/;

function isPlausibleYouTubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID.test(id) && !BLOCKED_YOUTUBE_VIDEO_IDS.has(id);
}

function normalizeYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function publicAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://my.skinfitwellness.in"
  ).replace(/\/$/, "");
}

function articleUrlForConcern(concern: string | null | undefined): string {
  const c = (concern ?? "").toLowerCase();
  if (/acne|pimple|breakout|blemish/.test(c)) {
    return "https://www.aad.org/public/diseases/acne/diy/diy-acne-treatment";
  }
  if (/pigment|melasma|dark spot|uneven|hyperpig/.test(c)) {
    return "https://www.aad.org/public/everyday-care/sun-protection/sunscreen-faqs";
  }
  if (/wrinkle|aging|fine line|sag/.test(c)) {
    return "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging-skin-care";
  }
  if (/dry|hydrat|barrier|flaky/.test(c)) {
    return "https://www.aad.org/public/everyday-care/skin-care-basics/dry/hydrated-skin";
  }
  if (/sun|uv|spf/.test(c)) {
    return "https://www.aad.org/public/everyday-care/sun-protection";
  }
  return TRACKER_RESOURCE_DEFAULTS.article.url;
}

function videoUrlForConcern(concern: string | null | undefined): string {
  const c = (concern ?? "").toLowerCase();
  if (/sun|uv|spf|pigment|melasma/.test(c)) {
    return TRACKER_RESOURCE_DEFAULTS.video.url;
  }
  if (/acne|pimple|breakout/.test(c)) {
    return "https://www.aad.org/public/diseases/acne/diy/diy-acne-treatment";
  }
  return "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101";
}

function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
  }
  return null;
}

export function resolveTrackerArticleUrl(
  source: string | null | undefined,
  primaryConcern?: string | null
): string {
  const raw = (source ?? "").trim();
  const parsed = parseHttpUrl(raw);
  if (parsed && isAllowedArticleHost(parsed.hostname)) {
    return parsed.href;
  }
  return articleUrlForConcern(primaryConcern);
}

export function resolveTrackerVideoUrl(
  llmUrl: string | null | undefined,
  options?: { title?: string; primaryConcern?: string | null }
): string {
  const title = (options?.title ?? "").toLowerCase();
  const parsed = parseHttpUrl(llmUrl ?? "");

  if (parsed) {
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "music.youtube.com") {
      return videoUrlForConcern(options?.primaryConcern);
    }
    if (host === "aad.org") {
      return parsed.href;
    }
    const videoId = extractYouTubeVideoId(parsed);
    if (videoId && isPlausibleYouTubeVideoId(videoId)) {
      return normalizeYouTubeWatchUrl(videoId);
    }
    // Trust other https links the LLM returned (review manually if needed).
    if (parsed.protocol === "https:") {
      return parsed.href;
    }
  }

  if (/5-angle|five.angle|check-in|face scan|kAI scan/.test(title)) {
    return `${publicAppOrigin()}${TRACKER_RESOURCE_DEFAULTS.scanGuide.path}`;
  }

  return videoUrlForConcern(options?.primaryConcern);
}

export function resolveTrackerInsightUrl(): string {
  return `${publicAppOrigin()}${TRACKER_RESOURCE_DEFAULTS.insightChat.path}`;
}

export function buildTrackerResources(input: {
  article: { title: string; source: string; why: string };
  video: { title: string; url: string; why: string };
  insight: { title: string; body: string };
  primaryConcern?: string | null;
}): PatientTrackerResource[] {
  const videoTitle =
    input.video.title.trim() || TRACKER_RESOURCE_DEFAULTS.scanGuide.title;

  return [
    {
      title: input.article.title.trim() || TRACKER_RESOURCE_DEFAULTS.article.title,
      url: resolveTrackerArticleUrl(input.article.source, input.primaryConcern),
      kind: "article",
    },
    {
      title: videoTitle,
      url: resolveTrackerVideoUrl(input.video.url, {
        title: input.video.title,
        primaryConcern: input.primaryConcern,
      }),
      kind: "video",
    },
    {
      title: input.insight.title.trim() || "kAI insight",
      url: resolveTrackerInsightUrl(),
      kind: "insight",
    },
  ];
}

export function sanitizeTrackerResources(
  resources: PatientTrackerResource[],
  primaryConcern?: string | null
): PatientTrackerResource[] {
  return resources.map((resource) => {
    switch (resource.kind) {
      case "article":
        return {
          ...resource,
          url: resolveTrackerArticleUrl(resource.url, primaryConcern),
        };
      case "video":
        return {
          ...resource,
          url: resolveTrackerVideoUrl(resource.url, {
            title: resource.title,
            primaryConcern,
          }),
        };
      case "insight":
        return {
          ...resource,
          url: resolveTrackerInsightUrl(),
        };
      default:
        return resource;
    }
  });
}

/** Legacy non-tracker PDF / report video list when tracker resources are absent. */
export const TRACKER_RECOMMENDED_VIDEOS: { label: string; href: string }[] = [
  {
    label: "Face washing 101",
    href: "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101",
  },
  {
    label: "Hydrated skin tips",
    href: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/hydrated-skin",
  },
  {
    label: "Skin care routine basics",
    href: TRACKER_RESOURCE_DEFAULTS.article.url,
  },
  {
    label: "How to apply sunscreen",
    href: TRACKER_RESOURCE_DEFAULTS.video.url,
  },
];
