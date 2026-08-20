# SkinFit Design Changelog

Running log of UI/UX changes to the web app (my.skinfitwellness.in).
Each entry describes what changed and why, with before/after.

---

## 2026-08-20 — Session 3: Delight moments

### Login page — illustrated hero panel
**Before:** Split-screen. Left panel was a plain navy gradient with just the logo + one line of tagline text. Cold, generic — looked like an admin login.
**After:** Left panel now has:
- Layered SVG artwork (concentric rings + soft glow) evoking kAI's face-analysis rings, in warm cream/navy
- Larger, bolder tagline ("Beautiful skin, built with intelligence.")
- Sub-copy explaining what's inside
- Trust chips ("AI Skin Analysis · Doctor-guided care")

Feels intentional and premium — like a product, not a form.

**Files:** `app/login/login-form.tsx`

### kAI intro — full-bleed hero (Stoic-style)
**Before:** kAI sat inside a rounded navy card, centered in the middle of a large sage-green page area. Card had visible corners, drop shadow, and lots of dead green space around it — read as a small "banner" rather than a hero.
**After:** Rounded card chrome removed entirely. Navy gradient now bleeds edge-to-edge and fills ~80vh vertically. Text scaled way up — "kAI." now `text-[8.5rem]` on desktop, "Your skin companion." in wide-tracked caps. kAI character is much larger (up to 640px tall on desktop) and bottom-anchored. Feels like a proper first-impression hero, no visible container.
**Files:** `components/onboarding/KaiMeetIntroCard.tsx`, `app/onboarding/kai-intro/page.tsx`

### Scan analysis — breathing animation
**Before:** Rotating spinner ring with a Sparkles icon, "Submitting your scan…" and "Just a moment" text, thin progress bar at the bottom. Felt like a generic loading state.
**After:** A slow-pulsing circle (4-second breathe cycle — expands + brightens, then contracts) with soft ripple rings behind it. Copy changed to:
- "Take a deep breath."
- "kAI is analysing your skin. This takes about 20 seconds."

Turns wait time into a calm moment instead of dead time.

**Files:** `components/dashboard/FaceScanFlow.tsx`

---

## Earlier changes (previous sessions)

Not detailed before/after — captured as a list since these predate this changelog:

- Warm gray page background (`#F5F3EF`) replaced greenish (`#F2F9F2`) across dashboard
- Top nav: flat sage green → frosted white with backdrop blur
- Mobile: hamburger menu replaced with permanent bottom tab bar (icons + labels)
- Time-based greeting on Build dashboard ("Good morning" / "afternoon" / "evening" + user name)
- Skin score: tiny grade pill → prominent 56×56 square with large number, color-coded band, sublabel + trend chip
- Micro-interactions: hover lift on cards, active-press scale on buttons, logo opacity hover
- CTA button system: unified `rounded-xl` + `font-semibold`; killed gradient/`rounded-full` outliers
- Typography scale: raw pixel sizes (`text-[15px]` etc.) replaced with semantic Tailwind steps; H1 stepped up on desktop
- Empty states: bare grey text → framed cards with icon + headline + explanatory copy
- Loading states: spinner + disabled on "View photos" and "Send request" buttons
- Reduced navy overuse: section header icons → slate, content text → near-black, inactive nav → slate

---

*Add new entries at the top. Keep before/after short — the codebase is the source of truth for exact classes.*
