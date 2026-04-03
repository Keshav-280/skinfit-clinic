import { format } from "date-fns";

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
  const dateStr = format(scanDate, "MMMM d, yyyy 'at' h:mm a");
  const overall = clamp(p.metrics.overall_score);
  const overview =
    p.aiSummary?.trim() ||
    "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early.";

  const imgSrc = JSON.stringify(p.imageUrl);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: Georgia, 'Times New Roman', serif; background: #F5F1E9; color: #18181b; }
    .card { max-width: 720px; margin: 0 auto; background: #F5F1E9; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.8); }
    .hdr { text-align: center; padding: 20px 16px 8px; }
    .kicker { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; font-family: system-ui, sans-serif; }
    h1 { font-size: 28px; font-weight: 500; margin: 8px 0 0; }
    .sub { font-size: 13px; color: #52525b; margin-top: 8px; font-family: system-ui, sans-serif; }
    .grid { display: table; width: 100%; padding: 16px; }
    .row { display: table-row; }
    .cell { display: table-cell; vertical-align: top; padding: 8px; width: 33%; }
    .cell-mid { text-align: center; }
    .meta { font-size: 13px; color: #52525b; font-family: system-ui, sans-serif; line-height: 1.6; }
    .face { max-width: 220px; margin: 0 auto; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.12); }
    .face img { width: 100%; display: block; vertical-align: top; }
    .metric { font-family: system-ui, sans-serif; font-size: 12px; margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.85); border-radius: 12px; border: 1px solid #fff; }
    .metric strong { display: block; margin-bottom: 4px; color: #3f3f46; }
    .hero { margin: 16px; padding: 20px; background: #fff; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
    .hero .big { font-size: 48px; font-weight: 500; color: #F29C91; margin: 8px 0; }
    .hero .lbl { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; font-family: system-ui, sans-serif; }
    .teal { padding: 24px 20px; background: linear-gradient(180deg, #E0EEEB 0%, #d8ebe6 100%); border-top: 1px solid #fff; }
    .teal h3 { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #27272a; font-family: system-ui, sans-serif; margin: 0 0 12px; }
    .teal p { font-size: 14px; line-height: 1.75; color: #3f3f46; margin: 0 0 14px; font-family: system-ui, sans-serif; }
    .two { display: table; width: 100%; }
    .two > div { display: table-cell; width: 50%; vertical-align: top; padding: 0 12px 0 0; }
    .foot { padding: 20px; text-align: center; font-size: 11px; color: #71717a; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <div class="kicker">AI scan report</div>
      <h1>Hello ${esc(p.userName)}</h1>
      ${displayTitle ? `<p class="sub">${esc(displayTitle)}</p>` : ""}
      <p class="sub">${esc(dateStr)}</p>
    </div>
    <div class="grid">
      <div class="row">
        <div class="cell">
          <p class="meta">Age: ${p.userAge} yrs · Skin type: ${esc(p.userSkinType)}</p>
          <p class="meta" style="margin-top:12px">${esc(LOREM_PROFILE)}</p>
        </div>
        <div class="cell cell-mid">
          <div class="face"><img src=${imgSrc} alt="Scan" /></div>
        </div>
        <div class="cell">
          <div class="metric"><strong>Acne</strong>${clamp(p.metrics.acne)}%</div>
          <div class="metric"><strong>Hydration</strong>${clamp(p.metrics.hydration)}%</div>
          <div class="metric"><strong>Wrinkles</strong>${clamp(p.metrics.wrinkles)}%</div>
          <div class="metric"><strong>Pigmentation</strong>${clamp(p.metrics.pigmentation)}%</div>
          <div class="metric"><strong>Texture</strong>${clamp(p.metrics.texture)}%</div>
        </div>
      </div>
    </div>
    <div class="hero">
      <div class="lbl">Your Skin Health</div>
      <div class="big">${overall}%</div>
      <p class="sub">Overall score from your latest AI analysis</p>
    </div>
    <div class="teal">
      <div class="two">
        <div>
          <h3>Overview</h3>
          <p>${esc(overview)}</p>
          <p>${esc(OVERVIEW_P2)}</p>
        </div>
        <div>
          <h3>Causes / Challenges</h3>
          <p>${esc(CAUSES_P1)}</p>
          <p>${esc(CAUSES_P2)}</p>
        </div>
      </div>
    </div>
    <div class="foot">SkinnFit Clinic · AI scan report (PDF generated in app)</div>
  </div>
</body>
</html>`;
}
