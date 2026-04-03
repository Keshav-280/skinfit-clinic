import { formatDistanceToNow } from "date-fns";

const LOREM_PROFILE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

const CAUSES_P1 =
  "Environmental factors such as UV exposure, seasonal dryness, and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";
const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin's triggers.";

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export type ScanReportPdfPayload = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  imageUrl: string;
  metrics: {
    acne: number;
    hydration: number;
    wrinkles: number;
    overall_score: number;
    pigmentation: number;
    texture: number;
  };
  aiSummary: string | null;
  scanDateIso: string;
};

/**
 * HTML for expo-print. Mirrors the web dashboard PDF: hero grid → skin health card → overview/teal
 * (no treatment videos / book CTA). Uses print CSS so the score card and teal block are not split
 * across pages when the engine supports break-inside.
 */
export function buildScanReportPdfHtml(p: ScanReportPdfPayload): string {
  const displayTitle = (() => {
    const raw = p.scanTitle?.trim() ?? "";
    if (!raw) return "";
    const stripped = raw
      .replace(/^ai\s*skin\s*scan\s*[–-]\s*/i, "")
      .replace(/^ai\s*skin\s*analysis\s*$/i, "");
    return stripped || "";
  })();

  const scanDate = new Date(p.scanDateIso);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });
  const overall = clamp(p.metrics.overall_score);
  const overview =
    p.aiSummary?.trim() ||
    "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early.";

  const imgSrc = JSON.stringify(p.imageUrl);
  const donutDeg = overall * 3.6;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    @page { margin: 10mm; }
    body {
      margin: 0;
      padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: #F5F1E9;
      color: #18181b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { max-width: 720px; margin: 0 auto; background: #F5F1E9; }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .fade-top {
      height: 120px;
      background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, transparent 100%);
      pointer-events: none;
    }
    .hero-pad { padding: 28px 20px 48px; }
    @media (min-width: 640px) {
      .hero-pad { padding: 36px 32px 56px; }
    }
    .kicker {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #71717a;
    }
    h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 2rem;
      font-weight: 500;
      line-height: 1.15;
      margin: 8px 0 0;
      color: #18181b;
    }
    @media (min-width: 640px) {
      h1 { font-size: 2.35rem; }
    }
    .age-line {
      margin-top: 14px;
      font-size: 13px;
      font-weight: 500;
      color: #52525b;
    }
    .body-copy {
      margin-top: 18px;
      font-size: 14px;
      line-height: 1.7;
      color: #52525b;
    }
    .hero-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      margin-top: 22px;
    }
    .hero-row { display: table-row; }
    .hero-cell {
      display: table-cell;
      vertical-align: top;
      padding: 6px 10px;
    }
    .hero-left { width: 36%; }
    .hero-mid { width: 28%; text-align: center; }
    .hero-right { width: 36%; }
    @media (max-width: 520px) {
      .hero-grid, .hero-row, .hero-cell { display: block; width: 100% !important; }
      .hero-cell { padding: 10px 0; }
      .hero-mid { text-align: center; }
    }
    .face {
      max-width: 240px;
      margin: 0 auto;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.12);
      box-shadow: 0 20px 50px -12px rgba(0,0,0,0.18);
    }
    .face img { width: 100%; height: auto; display: block; vertical-align: top; }
    .metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background: rgba(255,255,255,0.92);
      border-radius: 16px;
      border: 1px solid #fff;
      font-size: 13px;
      font-weight: 600;
      color: #3f3f46;
      max-width: 210px;
    }
    @media (min-width: 521px) {
      .metric { margin-left: auto; }
    }
    .metric .pct { width: 44px; text-align: right; font-variant-numeric: tabular-nums; color: #27272a; }
    .skin-card-wrap {
      margin-top: -3.5rem;
      padding: 0 20px 8px;
      position: relative;
      z-index: 2;
    }
    @media (min-width: 640px) {
      .skin-card-wrap { margin-top: -5.5rem; padding: 0 32px 8px; }
    }
    .skin-card {
      max-width: 32rem;
      margin: 0 auto;
      padding: 22px 22px;
      background: #fff;
      border-radius: 20px;
      border: 1px solid #fff;
      box-shadow: 0 24px 48px -12px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.06);
    }
    @media (min-width: 640px) {
      .skin-card { padding: 26px 34px; }
    }
    .skin-row {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 18px;
    }
    @media (min-width: 640px) {
      .skin-row {
        flex-direction: row;
        align-items: center;
        gap: 28px;
      }
    }
    .skin-lbl {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #71717a;
    }
    .skin-big {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 2.75rem;
      font-weight: 500;
      line-height: 1;
      color: #F29C91;
      margin-top: 6px;
    }
    @media (min-width: 640px) {
      .skin-big { font-size: 3.15rem; }
    }
    .skin-sub { margin-top: 8px; font-size: 12px; font-weight: 500; color: #71717a; }
    .skin-donut-col {
      display: flex;
      justify-content: center;
      flex: 1;
    }
    @media (min-width: 640px) {
      .skin-donut-col { justify-content: flex-end; }
    }
    .donut {
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: conic-gradient(#F29C91 0deg ${donutDeg}deg, #F0E4E1 ${donutDeg}deg 360deg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 9px;
      box-shadow: 0 4px 14px rgba(242,156,145,0.25);
      border: 1px solid rgba(0,0,0,0.12);
    }
    .donut-hole {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #fff;
    }
    .teal {
      margin-top: 2.5rem;
      padding: 44px 20px 48px;
      border-top: 1px solid #fff;
      background: linear-gradient(180deg, #E0EEEB 0%, #d8ebe6 100%);
    }
    @media (min-width: 640px) {
      .teal { padding-left: 32px; padding-right: 32px; }
    }
    .teal-rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
      margin-bottom: 22px;
    }
    .teal-two { display: table; width: 100%; }
    .teal-two > div {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 16px;
    }
    .teal-two > div:last-child { padding-right: 0; padding-left: 16px; }
    @media (max-width: 639px) {
      .teal-two, .teal-two > div { display: block; width: 100%; padding: 0 !important; }
      .teal-two > div:first-child { margin-bottom: 28px; }
    }
    .teal-bar {
      width: 32px;
      height: 3px;
      border-radius: 2px;
      background: #27272a;
      margin-bottom: 12px;
    }
    .teal-h {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #27272a;
      margin: 0 0 14px;
    }
    .teal-p {
      font-size: 14px;
      line-height: 1.75;
      color: #3f3f46;
      margin: 0 0 14px;
      orphans: 3;
      widows: 3;
    }
    .foot {
      padding: 20px;
      text-align: center;
      font-size: 10px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="avoid-break">
      <div class="fade-top"></div>
      <div class="hero-pad">
        <div class="hero-grid">
          <div class="hero-row">
            <div class="hero-cell hero-left">
              <div class="kicker">AI scan report</div>
              <h1>Hello ${esc(p.userName)}</h1>
              ${displayTitle ? `<p class="age-line" style="margin-top:6px;font-weight:600;color:#3f3f46">${esc(displayTitle)}</p>` : ""}
              <p class="age-line">Age: ${p.userAge} yrs <span style="color:#a1a1aa">·</span> Skin type: ${esc(p.userSkinType)}</p>
              <p class="body-copy">${esc(LOREM_PROFILE)}</p>
            </div>
            <div class="hero-cell hero-mid">
              <div class="face"><img src=${imgSrc} alt="Your scan" /></div>
            </div>
            <div class="hero-cell hero-right">
              <div class="metric"><span>Acne</span><span class="pct">${clamp(p.metrics.acne)}%</span></div>
              <div class="metric"><span>Hydration</span><span class="pct">${clamp(p.metrics.hydration)}%</span></div>
              <div class="metric"><span>Wrinkles</span><span class="pct">${clamp(p.metrics.wrinkles)}%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="skin-card-wrap avoid-break">
      <div class="skin-card">
        <div class="skin-row">
          <div style="min-width:0">
            <div class="skin-lbl">Your Skin Health</div>
            <div class="skin-big">${overall}%</div>
            <div class="skin-sub">Last scan: ${esc(lastScanLabel)}</div>
          </div>
          <div class="skin-donut-col">
            <div class="donut"><div class="donut-hole"></div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="teal avoid-break">
      <div class="teal-rule"></div>
      <div class="teal-two">
        <div>
          <div class="teal-bar"></div>
          <h2 class="teal-h">Overview</h2>
          <p class="teal-p">${esc(overview)}</p>
          <p class="teal-p">${esc(OVERVIEW_P2)}</p>
        </div>
        <div>
          <div class="teal-bar"></div>
          <h2 class="teal-h">Causes/Challenges</h2>
          <p class="teal-p">${esc(CAUSES_P1)}</p>
          <p class="teal-p">${esc(CAUSES_P2)}</p>
        </div>
      </div>
    </div>

    <div class="foot">SkinnFit Clinic · AI scan report</div>
  </div>
</body>
</html>`;
}
