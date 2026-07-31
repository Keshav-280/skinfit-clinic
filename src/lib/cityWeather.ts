import { getCache } from "@/src/lib/infra";

export type CityWeatherData = {
  city: string;
  tempC: number;
  humidity: number;
  condition: string;
  uvIndex: number;
  aqi: number | null;
};

const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const REDIS_TTL_SEC = 6 * 60 * 60;

const memoryCache = new Map<
  string,
  { expiresAt: number; data: CityWeatherData }
>();

type WeatherApiCurrent = {
  location?: { name?: string };
  current?: {
    temp_c?: number;
    humidity?: number;
    condition?: { text?: string };
    uv?: number;
    air_quality?: {
      pm2_5?: number;
      "us-epa-index"?: number;
    };
  };
};

/** Rough US AQI from PM2.5 (µg/m³) using EPA breakpoints. */
function aqiFromPm25(pm25: number): number {
  const breakpoints: Array<[number, number, number, number]> = [
    [0, 12, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (pm25 >= cLow && pm25 <= cHigh) {
      return Math.round(
        ((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow
      );
    }
  }
  if (pm25 > 500.4) return 500;
  return Math.max(0, Math.round(pm25));
}

function deriveConditionLabel(opts: {
  tempC: number;
  humidity: number;
  conditionText: string;
}): string {
  const raw = opts.conditionText.trim() || "Clear";
  const humid =
    opts.humidity >= 75 ? "Humid" : opts.humidity <= 35 ? "Dry" : null;
  const temp =
    opts.tempC >= 32 ? "Hot" : opts.tempC <= 15 ? "Cold" : null;
  const sky = /cloud|overcast/i.test(raw)
    ? "Cloudy"
    : /rain|drizzle|thunder/i.test(raw)
      ? "Rainy"
      : /sun|clear/i.test(raw)
        ? "Sunny"
        : raw;
  const parts = [temp, humid, sky].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} & ${parts[1]}`;
  if (parts.length === 1) return String(parts[0]);
  return raw;
}

function cacheKey(city: string): string {
  return `city-weather:${city.trim().toLowerCase()}`;
}

async function fetchWeatherApi(city: string): Promise<CityWeatherData | null> {
  const key = process.env.WEATHER_API_KEY?.trim();
  if (!key) {
    console.info("[cityWeather] skipped — WEATHER_API_KEY not set");
    return null;
  }

  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", key);
  url.searchParams.set("q", city);
  url.searchParams.set("aqi", "yes");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn("[cityWeather] API failed", res.status);
    return null;
  }

  const json = (await res.json()) as WeatherApiCurrent;
  const cur = json.current;
  if (!cur || typeof cur.temp_c !== "number" || typeof cur.humidity !== "number") {
    return null;
  }

  const pm25 = cur.air_quality?.pm2_5;
  const aqi =
    typeof pm25 === "number" && Number.isFinite(pm25)
      ? aqiFromPm25(pm25)
      : typeof cur.air_quality?.["us-epa-index"] === "number"
        ? cur.air_quality["us-epa-index"]
        : null;

  const conditionText = cur.condition?.text?.trim() || "Clear";
  return {
    city: json.location?.name?.trim() || city,
    tempC: Math.round(cur.temp_c),
    humidity: Math.round(cur.humidity),
    condition: deriveConditionLabel({
      tempC: cur.temp_c,
      humidity: cur.humidity,
      conditionText,
    }),
    uvIndex: typeof cur.uv === "number" ? Math.round(cur.uv) : 0,
    aqi,
  };
}

/**
 * Live weather for a patient city (WeatherAPI.com).
 * Cached 6h in-memory + Redis when available. Returns null on empty city / missing key / errors.
 */
export async function fetchCityWeather(
  city: string
): Promise<CityWeatherData | null> {
  const trimmed = city?.trim();
  if (!trimmed) return null;

  const key = cacheKey(trimmed);
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) return mem.data;

  try {
    const hit = await getCache().get<CityWeatherData>(key);
    if (hit) {
      memoryCache.set(key, { expiresAt: now + MEMORY_TTL_MS, data: hit });
      return hit;
    }
  } catch {
    /* redis optional */
  }

  try {
    const fresh = await fetchWeatherApi(trimmed);
    if (!fresh) return null;
    memoryCache.set(key, { expiresAt: now + MEMORY_TTL_MS, data: fresh });
    try {
      await getCache().set(key, fresh, REDIS_TTL_SEC);
    } catch {
      /* ignore */
    }
    return fresh;
  } catch (e) {
    console.warn("[cityWeather] fetch error", e);
    return null;
  }
}
