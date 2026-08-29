# SkinFit Mobile App — Full Audit & Reference

> **Generated:** 2026-05-29  
> **Stack:** Expo SDK 54 · React Native 0.81 · Expo Router 6 · TypeScript  
> **Backend:** Next.js API at `EXPO_PUBLIC_API_URL` (currently `http://13.234.166.154` in EAS profiles)

This document maps every screen, API call, cache layer, and known gap in the patient mobile app under `mobile/`.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Navigation & routes](#2-navigation--routes)
3. [Authentication & session](#3-authentication--session)
4. [API endpoints used by mobile](#4-api-endpoints-used-by-mobile)
5. [Local storage & caching](#5-local-storage--caching)
6. [Push notifications & live updates](#6-push-notifications--live-updates)
7. [Face scan pipeline](#7-face-scan-pipeline)
8. [Build, env & deployment](#8-build-env--deployment)
9. [Issues & bugs found](#9-issues--bugs-found)
10. [How to make it better](#10-how-to-make-it-better)
11. [Suggested features to implement](#11-suggested-features-to-implement)
12. [kAI insights — Today’s focus, weekly & monthly](#12-kai-insights--todays-focus-weekly-report-monthly-insight)

---

## 1. Architecture overview

```
mobile/
├── app/                    # Expo Router file-based routes
│   ├── index.tsx           # Auth gate → login | onboarding | drawer
│   ├── login.tsx, signup.tsx
│   ├── onboarding/         # Baseline scan + questionnaire flow
│   └── (drawer)/           # Main app (bottom dock navigation)
├── components/             # Reusable UI (reports, scan, profile, push)
├── contexts/AuthContext.tsx
├── hooks/                  # Tracker auto-save, scan capture guidance
└── lib/                    # API client, cache, OAuth, scan submit, PDF, etc.
```

**API client:** All authenticated calls go through `lib/api.ts`:

- `apiFetch(path, token, init)` — adds `Authorization: Bearer …`
- `apiJson<T>(path, token, init)` — parses JSON, throws `ApiError` on non-2xx
- Base URL from `EXPO_PUBLIC_API_URL` via `lib/apiBase.ts`

**Shared code:** Mobile imports some utilities from repo root (e.g. `src/lib/chatE2ee/format` for display text).

**Navigation pattern:** Drawer exists but has **width 0** — users navigate via a **floating bottom dock** (Home, Schedules, Scan, Chat, Profile). Secondary screens are hidden drawer items (`drawerItemStyle: { display: "none" }`).

---

## 2. Navigation & routes

### 2.1 Root stack (`app/_layout.tsx`)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | Loading → redirect by auth/onboarding state |
| `/login` | `app/login.tsx` | Email/password + OAuth sign-in |
| `/signup` | `app/signup.tsx` | Registration |
| `/onboarding/*` | `app/onboarding/` | New-user baseline flow |
| `/(drawer)/*` | `app/(drawer)/` | Main authenticated app |
| `/modal` | `app/modal.tsx` | Template modal (minimal use) |

### 2.2 Onboarding stack (`app/onboarding/`)

| Route | File | In `_layout`? | Purpose |
|-------|------|---------------|---------|
| `/onboarding` | `index.tsx` | implicit | Welcome screen |
| `/onboarding/kai-intro` | `kai-intro.tsx` | **No** | kAI intro |
| `/onboarding/questionnaire` | `questionnaire.tsx` | **No** | Health questionnaire |
| `/onboarding/capture-intro` | `capture-intro.tsx` | Yes | Scan instructions |
| `/onboarding/capture` | `capture.tsx` | Yes | 5-angle face capture |
| `/onboarding/baseline-report` | `baseline-report.tsx` | Yes | First scan report |

`OnboardingResumeGate` calls `GET /api/onboarding/resume` and redirects users to the correct step.

### 2.3 Main app — drawer routes

#### Dock-visible (primary)

| Route | File | Purpose |
|-------|------|---------|
| `/(drawer)` | `index.tsx` | Home dashboard (Today’s focus, journal, routines, voice to doctor) |
| `/(drawer)/schedules` | `schedules.tsx` | Calendar + appointment requests |
| `/(drawer)/scan` | `scan.tsx` | New AI face scan capture |
| `/(drawer)/chat` | `chat.tsx` | AI / doctor / clinic support chat |
| `/(drawer)/profile` | `profile.tsx` | Profile, skin identity, weekly/monthly insights |

#### Hidden (linked from other screens)

| Route | File | Purpose |
|-------|------|---------|
| `/(drawer)/history` | `history/index.tsx` | Scan history list |
| `/(drawer)/history/[id]` | `history/[id].tsx` | Single scan report |
| `/(drawer)/history/visits` | `history/visits.tsx` | Clinic visit list |
| `/(drawer)/history/visit/[visitId]` | `history/visit/[visitId].tsx` | Visit detail |
| `/(drawer)/notifications` | `notifications.tsx` | Inbox-style notification center |
| `/(drawer)/edit-profile` | `edit-profile.tsx` | Name, email, phone, photo |
| `/(drawer)/upcoming-appointments` | `upcoming-appointments.tsx` | Pending schedule requests |
| `/(drawer)/sleep-tracker` | `sleep-tracker.tsx` | Daily sleep journal |
| `/(drawer)/hydration-tracker` | `hydration-tracker.tsx` | Water + insight |
| `/(drawer)/stress-tracker` | `stress-tracker.tsx` | Stress level journal |
| `/(drawer)/morning-routine` | `morning-routine.tsx` | AM routine checklist |
| `/(drawer)/night-routine` | `night-routine.tsx` | PM routine checklist |
| `/(drawer)/all-skin-params` | `all-skin-params.tsx` | All skin metrics from home API |
| `/(drawer)/wellness` | `wellness.tsx` | **Placeholder — “Coming soon”** |

---

## 3. Authentication & session

### Flow

1. App start → read `skinfit_session_token` + `skinfit_user_json` from **SecureStore** (native) or **localStorage** (web).
2. If token exists → `GET /api/user/profile` to refresh onboarding flags.
3. Gate:
   - No token → `/login`
   - Token but `!canAccessDashboard` → `/onboarding`
   - Else → `/(drawer)`

### Auth API calls

| Method | Endpoint | Used by |
|--------|----------|---------|
| POST | `/api/auth/login` | Sign in (`X-Skinfit-Client: native`) |
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/oauth/native` | Google / Apple native OAuth |
| GET | `/api/auth/oauth/google?mobile_return=…` | OAuth web fallback start |
| GET | `/api/user/profile` | Session refresh, edit profile |
| PATCH | `/api/user/profile` | Edit profile (native fetch) |

### Sign-out cleanup

- Clears SecureStore session keys
- `clearAllAppCaches()` — AsyncStorage prefixes
- `clearAllCachedPhotos()` — document directory avatars
- `DELETE` push token via `/api/user/push-token`

---

## 4. API endpoints used by mobile

Endpoints **not** listed here are used by the web app / doctor portal only.

### Auth & user

| Method | Endpoint | Screen / module | Notes |
|--------|----------|-----------------|-------|
| POST | `/api/auth/login` | AuthContext | |
| POST | `/api/auth/register` | AuthContext | |
| POST | `/api/auth/oauth/native` | AuthContext | |
| GET | `/api/user/profile` | AuthContext, profile, edit-profile | |
| PATCH | `/api/user/profile` | edit-profile.tsx | |
| GET | `/api/user/profile-photo` | profilePhoto.ts | |
| POST | `/api/user/profile-photo` | profilePhoto.ts | multipart upload |
| POST | `/api/user/push-token` | pushNotifications.ts | Register Expo token |
| DELETE | `/api/user/push-token` | pushNotifications.ts | On sign-out |

### Onboarding

| Method | Endpoint | Screen | Notes |
|--------|----------|--------|-------|
| GET | `/api/onboarding/resume` | OnboardingResumeGate, questionnaire | Routing state |
| POST | `/api/onboarding/questionnaire` | questionnaire.tsx | Submit answers |
| POST | `/api/onboarding/complete` | *(via resume redirect)* | Server-side completion |

### Patient home & profile data

| Method | Endpoint | Screen | Notes |
|--------|----------|--------|-------|
| GET | `/api/patient/home` | index, profile, routines, all-skin-params | Dashboard payload |
| GET | `/api/patient/skin-profile` | profile, visit detail | Includes `visits[]` |
| GET | `/api/patient/monthly-insight` | profile | Cached |
| GET | `/api/patient/hydration-insight` | hydration-tracker | |
| GET | `/api/patient/history` | history, visits | Scan + visit list |
| GET | `/api/patient/scans/:id` | history/[id] | Full report |
| GET | `/api/patient/scans/:id/image` | Report images | Bearer required |
| GET | `/api/patient/tracker?scanId=` | history/[id] | Tracker overlay |
| POST | `/api/patient/doctor-feedback/viewed` | notifications.tsx | Mark feedback seen |

### Journal & wellness trackers

| Method | Endpoint | Screen | Notes |
|--------|----------|--------|-------|
| GET | `/api/journal?date=YYYY-MM-DD` | index, sleep, stress, hydration | Daily entry |
| POST | `/api/journal` | index, trackers, routines, useDebouncedTrackerAutoSave | Upsert journal fields |

### Schedules & appointments

| Method | Endpoint | Screen | Notes |
|--------|----------|--------|-------|
| GET | `/api/patient/schedules` | schedules.tsx | Bootstrap calendar |
| GET | `/api/calendar/patient` | chat.tsx (home data) | Upcoming events |
| GET | `/api/patient/schedule-requests` | upcoming-appointments.tsx | List requests |
| POST | `/api/patient/schedule-requests` | schedules.tsx, upcoming-appointments | New request |
| PATCH | `/api/patient/schedule-requests/:id` | upcoming-appointments.tsx | Cancel/update |
| POST | `/api/appointments/reminders/tick` | chat.tsx | **Side effect on chat mount** — triggers server reminder job |

### Chat & AI

| Method | Endpoint | Screen | Notes |
|--------|----------|--------|-------|
| GET | `/api/chat/plain/messages?assistantId=&doctorId=` | chat.tsx | Load thread |
| POST | `/api/chat/plain/message` | chat.tsx, index.tsx (voice) | Send patient message |
| POST | `/api/chat/plain/thread` | chat.tsx | Create AI/support thread |
| POST | `/api/chat/plain/reply` | chat.tsx | Seed assistant greeting |
| POST | `/api/chat/plain/clear-view` | chat.tsx | Patient “clear chat” (soft hide) |
| GET | `/api/chat/inbox/unread?supportSince=&doctorSince=` | chat, notifications, NotificationBell | Unread counts |
| GET | `/api/chat/doctor-profile` | chat.tsx | Doctor avatars/specialty |
| GET | `/api/patient/doctors` | chat.tsx | Registered doctors list |
| POST | `/api/ai/chat` | chat.tsx | AI assistant replies |

**Not used on mobile (web has it):**

| Method | Endpoint | Gap |
|--------|----------|-----|
| GET | `/api/chat/plain/stream` | **No SSE/live stream on mobile** — polling only |

### Voice notes

| Method | Endpoint | Screen |
|--------|----------|--------|
| POST | `/api/patient/voice-notes/:id` | index.tsx, history/index.tsx |

### Face scan & ML

| Method | Endpoint | Screen / module |
|--------|----------|-----------------|
| POST | `/api/capture/preview` | fetchFacePreviewInference.ts (on-device guidance) |
| POST | `/api/scans/submit` | submitFaceScan.ts | Async queue (202 + jobId) |
| POST | `/api/scan` | submitFaceScan.ts | Sync fallback if queue unavailable |
| GET | `/api/scans/status/:jobId` | ScanJobReadyNotifier.tsx | Poll until complete/failed |

### Static / file access

| Method | Endpoint | Usage |
|--------|----------|-------|
| GET | `/api/files/*` | Authenticated file downloads |
| GET | `/api/patient/scans/:id/image` | Scan thumbnails in reports |

---

## 5. Local storage & caching

### SecureStore / session (`lib/sessionStorageNativeOrWeb.ts`)

| Key | Content |
|-----|---------|
| `skinfit_session_token` | JWT bearer token |
| `skinfit_user_json` | Cached user object (id, name, email, onboarding flags) |

### AsyncStorage — app cache (`lib/apiCache.ts`)

Prefix: `@skf_cache:{userId}:` (user-scoped after login)

| Logical key | Used by | Data |
|-------------|---------|------|
| `profile` | profile.tsx | User profile |
| `skin-profile` | profile.tsx | Skin profile payload |
| `monthly-insight` | profile.tsx | Monthly AI insight |
| `home` | profile.tsx | Home dashboard snapshot |

Also cleared on logout: keys starting with `skinfit-chat`, `skinfit.clinic`, `skinfit.doctor`, `skinfit_onboarding`.

### AsyncStorage — chat (`chat.tsx`)

| Key | Content |
|-----|---------|
| `skinfit-chat-home-v2` | Doctor list + home row previews |
| `skinfit-chat-thread-v1:{assistantId}` | Cached messages per thread |
| `skinfit-chat-thread-v1:doctor:{doctorId}` | Per-doctor thread cache |

**Pattern:** Show cache immediately → fetch API → overwrite.

### AsyncStorage — inbox cursors (`lib/inboxReadCursors.ts`)

| Key | Purpose |
|-----|---------|
| `skinfit.clinicSupportLastSeenAt` | Unread clinic/support messages |
| `skinfit.doctorChatLastSeenAt` | Unread doctor messages |

### AsyncStorage — scans (`lib/scanJobNotifications.ts`)

| Key | Purpose |
|-----|---------|
| `skinfit.scanJobs.pending.v1` | In-flight scan job IDs |
| `skinfit.scanJobs.ready.v1` | Completed scans not yet opened |
| `skinfit.scanJobs.seen.v1` | Dismissed ready notifications |

### AsyncStorage — onboarding draft

| Key | Purpose |
|-----|---------|
| `skinfit_onboarding_questionnaire_draft` | Partial questionnaire answers |

### FileSystem — disk cache

| Location | Module | Purpose |
|----------|--------|---------|
| `documentDirectory/profile-photos/` | profilePhoto.ts | Avatar JPEG per user |
| `cacheDirectory/scan-img-*` | fetchAuthenticatedScanImage.ts | Auth’d scan images |
| `cacheDirectory/*_voice_*` | index, history | Voice note playback |
| `cacheDirectory/attachments/` | visit detail | Shared visit attachments |
| Scan report PDF | scanReportPdf.ts | Temp PDF for share |

### In-memory (session only)

- `fetchAuthenticatedScanImage.ts` — `Map` of URI → local file path

---

## 6. Push notifications & live updates

### Registration (mobile)

| Step | Where | Behavior |
|------|--------|----------|
| Sign in / sign up / OAuth | `AuthContext.applyAuthSession` | `registerForPushAndSyncToken(..., { requestPermission: true, verboseAlerts: true })` — shows the **Android/iOS system permission dialog** on first login |
| Session restore | `PushTokenSync` | Re-syncs token when permission already granted; if status is **undetermined**, requests permission once |
| Sign out | `AuthContext.signOut` | `POST /api/user/push-token` with `expoPushToken: null` |

**Removed (2026-05-29):** The Notifications screen no longer has “Enable push alerts / Turn off” toggles. That UI showed “Notifications on” even when `getExpoPushTokenAsync` failed, which hid real delivery problems.

Flow in `mobile/lib/pushNotifications.ts`:

1. Physical device only (simulator → no token).
2. Android: create `default` notification channel.
3. `getPermissionsAsync` → `requestPermissionsAsync` if needed.
4. `getExpoPushTokenAsync({ projectId })` — `projectId` from `app.json` → `extra.eas.projectId` (`1da8bd8e-7568-4c2b-8bc8-716554500736`).
5. `POST /api/user/push-token` with bearer session.

### Why pushes can fail even when the app “looks” configured

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No OS permission prompt on Android | Old build before login-time registration; or permission already denied — check **Settings → Apps → SkinFit → Notifications** | Reinstall or enable in Settings; sign in again |
| Permission granted, still no pushes | **FCM credentials missing on EAS** for the Android build profile | Expo dashboard → Project → Credentials → Android → upload **FCM V1 service account JSON**; rebuild APK/AAB |
| Token never saved on server | `getExpoPushTokenAsync` throws (missing FCM, wrong `google-services.json`, or simulator) | Ensure `mobile/google-services.json` exists (wired in `app.config.js`); rebuild with EAS `preview` / `production` |
| Server sends but device silent | Expo push receipt errors, expired token, or channel importance | Check server logs for Expo push API errors; user must open app once after install so token re-syncs |
| In-app bell works, lock-screen does not | Token not registered or push type not handled | Confirm row in DB for user’s `expoPushToken`; test with Expo push tool using stored token |

**Note:** In-app unread counts (bell, Notifications screen) come from **`GET /api/chat/inbox/unread`** and local scan-job storage — they do **not** prove push delivery works.

### Server → patient push types (relevant to mobile)

| Server event | Push `data.type` | Mobile tap handler |
|--------------|------------------|---------------------|
| Doctor/clinic reply | `clinic_chat` | Opens `/(drawer)/chat` (generic) |
| Scan ready | `scan_report_ready` | Opens `/(drawer)/history/:scanId` |
| Scan failed | `scan_report_failed` | Opens `/(drawer)/scan` |
| Doctor voice note | `doctor_voice_note` | History or home |

**Missing handlers:** No tap routing for `sos_chat`, appointment reminders, or opening a **specific doctor thread**.

### Foreground / polling refresh

| Component | Refresh strategy |
|-----------|------------------|
| NotificationBell | Focus + AppState + 15s interval |
| ScanJobReadyNotifier | 8s poll on pending jobs |
| Chat home list | 20s interval when in home mode |
| Chat thread | Reload on thread switch only — **no interval while thread open** |
| Profile | Stale-while-revalidate + pull-to-refresh |
| Home dashboard | Focus refresh + pull-to-refresh |

**Web comparison:** Patient web chat uses `EventSource` on `/api/chat/plain/stream` for instant updates. Mobile does not.

---

## 12. kAI insights — Today’s focus, weekly report, monthly insight

This section documents the **three insight surfaces** visible in the mobile app and how they relate to the backend RAG + LLM pipeline.

### Where they appear on mobile

| UI label | Screen | API | Unlocks when |
|----------|--------|-----|--------------|
| **Today’s Focus** | Home `/(drawer)/index.tsx` | `GET /api/patient/home` → `todayFocus` | `onboardingComplete` |
| **Last week’s Report** (key observations + priority actions) | Profile `/(drawer)/profile.tsx` | `GET /api/patient/skin-profile` → `keyObservations`, `priorityKnowDo` | Questionnaire complete |
| **This Month’s Report** | Profile | `GET /api/patient/monthly-insight` | Calendar lock until month-end cron |

Mobile does **not** call `GET /api/patient/rag-kai-insights` (that route powers the web dashboard RAG panel).

---

### 1. Today’s Focus (daily)

**Data path**

```
GET /api/patient/home
  → dailyFocus table row for today (if doctor/clinic set one in portal)
  → else resolveTodayFocus() inline LLM in app/api/patient/home/route.ts
```

**LLM fallback (when no clinician row and viewing today)**

- Requires `OPENAI_API_KEY` and `isLlmEnabled()`.
- Model: `OPENAI_CHAT_MODEL` or default **`gpt-4o-mini`**.
- Inputs: patient name, skin type, primary concern, kAI score, weakest scan parameter, last 7 days of journal (routine completion, sleep, water, stress).
- Output: JSON `{ message, sourceParam }` inserted into `dailyFocus` with `onConflictDoNothing`.
- **No RAG / textbook retrieval** on this path — pure structured prompt.

**Cron:** `runDailyFocusJob()` in `src/lib/cronKaiJobs.ts` is a **no-op** (clinician-set only). Generic auto-copy was intentionally removed.

**Potential issues**

| Issue | Impact |
|-------|--------|
| No `OPENAI_API_KEY` on EC2 | Home shows no focus card (only locked state before onboarding) |
| Viewing a past journal date on home | Focus hidden (`!isSelectedToday`) — by design |
| Doctor sets focus in portal but home cached | Redis `cacheAside` on home may serve stale payload until TTL / invalidation |
| LLM JSON parse failure | Silent `null` — no user-visible error |

**Quality levers:** Stronger model (`gpt-4o` / `gpt-4.1`) improves tone and specificity; adding **RAG snippets** (sleep/stress/parameter-specific textbook chunks) would align daily tips with weekly/monthly quality.

---

### 2. Weekly insight (profile — “Last week’s Report”)

**Data path**

```
GET /api/patient/skin-profile
  → buildProfileKeyObservationsLlm()   } src/lib/profileRagInsights.ts
  → buildProfilePriorityKnowDoLlm()  }
  → gatherProfileInsightContext()    } src/lib/profileInsightContext.ts
```

**RAG pipeline (production)**

```
buildProfileRetrievalQuery(context)
  → productionTextbookRetrieve()     } src/lib/ragRetrieve.ts
       ├─ Pinecone hybrid (if PINECONE_* env set)
       └─ else BM25 on local textbook JSON catalog
  → top-K chunks passed into OpenAI JSON prompt
  → keyObservations.items[] + priorityKnowDo.do[]
```

- Model: **`gpt-4o-mini`** unless `OPENAI_CHAT_MODEL` overrides.
- Temperature ~0.45, `response_format: json_object`.
- Sets `insightsUnavailable: true` when OpenAI key missing or LLM returns null — mobile shows a generic “temporarily unavailable” message (no dev/server key text).

**Separate cron path:** `runWeeklyKaiJob()` inserts **`weeklyReports`** rows with a **static placeholder narrative** when a patient has ≥2 scans in 7 days. That table is **not** what powers the profile card’s rich LLM observations — those are computed on demand in `skin-profile`.

**Potential issues**

| Issue | Impact |
|-------|--------|
| Pinecone not configured | BM25-only retrieval — works but weaker semantic match on long queries |
| Sparse journal / single scan | `gatherProfileInsightContext` may produce thin observations |
| Every profile load can trigger LLM | Cost + latency; no long-lived cache of generated observations |
| Cron placeholder vs profile LLM | Operators may confuse DB `weeklyReports.narrativeText` with what the app shows |

---

### 3. Monthly insight (profile — “This Month’s Report”)

**Data path**

```
GET /api/patient/monthly-insight
  → monthlyReports.payloadJson for current month
  → locked until nextInsightAt if cron has not run for this month
```

**Cron:** `runMonthlyReportsJob()` in `src/lib/cronKaiJobs.ts`

| Mode | Env | Behavior |
|------|-----|----------|
| **Default** | (none) | Inserts placeholder JSON: `{ note: "Automated monthly placeholder…" }` — **not useful in UI** |
| **Production RAG** | `KAI_MONTHLY_CRON_RAG=1` | Calls `generateRagKaiOutput()` (`src/lib/ragKaiTestService.ts`) for patients with ≥1 scan; stores `rag_monthly_v1` payload via `buildMonthlyRagCronPayload()` |
| Cost cap | `KAI_MONTHLY_CRON_MAX_PATIENTS` (default 25) | Only N patients per cron run |

RAG monthly uses the same **`productionTextbookRetrieve`** stack as profile weekly insights, plus full scan/journal correlation pack from `buildNarrativeSignalPack`.

**Potential issues**

| Issue | Impact |
|-------|--------|
| Cron RAG flag off on EC2 | Users see locked card or empty placeholder after unlock |
| Cap too low | Many patients never get a monthly row in a given run |
| Cron schedule not wired | `monthlyReports` never inserted — perpetual lock |
| Mobile caches monthly payload | Stale month after cron backfill until profile refresh |

---

### Vector search & model infrastructure recommendations

**Current stack (as implemented)**

| Layer | Technology | Notes |
|-------|------------|-------|
| Embeddings / vector | **Pinecone** (optional) | Hybrid RRF with BM25 when `PINECONE_*` configured |
| Fallback retrieval | **BM25** on bundled textbook JSON | No runtime dependency; used today if Pinecone absent |
| **pgvector** | Not used in retrieval path | No `pgvector` references in repo; Postgres stores app data, not textbook embeddings |
| Chat model | **`gpt-4o-mini`** default | All insight LLM calls |

**Pinecone vs stay on BM25 (or add pgvector)**

| Option | Pros | Cons |
|--------|------|------|
| **Keep BM25-only** | Zero extra infra/cost; already shipped | Weaker paraphrase matching; manual catalog updates |
| **Pinecone (recommended for production RAG)** | Managed, fast hybrid with existing code path | Monthly cost; must keep index in sync with textbook ingest |
| **pgvector in Postgres** | Single DB, no Pinecone bill; good if you already run Postgres heavily | Requires embedding pipeline, chunk table, and rewriting `productionTextbookRetrieve`; not implemented yet |

**Recommendation:** Enable **Pinecone** on EC2 for weekly + monthly RAG first (code already supports it). Consider pgvector only if you want to eliminate Pinecone and own embedding refresh in Drizzle migrations.

**Model upgrades**

| Use case | Current | Suggested |
|----------|---------|-----------|
| Daily focus (short tip) | gpt-4o-mini | Keep mini — sufficient for 2-sentence JSON |
| Weekly key observations + priority actions | gpt-4o-mini | **`gpt-4o`** or **`gpt-4.1-mini`** for better clinical phrasing and JSON reliability |
| Monthly RAG narrative | gpt-4o-mini via `generateRagKaiOutput` | **`gpt-4o`** when `KAI_MONTHLY_CRON_RAG=1` — longer structured output |

Use env `OPENAI_CHAT_MODEL` globally or split per job with dedicated env vars if daily cost must stay low while monthly uses a stronger model.

**Operational checklist for “good insights”**

1. `OPENAI_API_KEY` set on EC2 web container.
2. `KAI_MONTHLY_CRON_RAG=1` + cron hitting `/api/cron/kai-monthly` (or equivalent scheduler).
3. Pinecone index populated from textbook ingest scripts (if using hybrid RAG).
4. Patients complete questionnaire + baseline scan + regular journal entries (RAG context quality).
5. Invalidate or shorten Redis cache on `skin-profile` / home after doctor updates focus or routine.

**Key files**

| Concern | Path |
|---------|------|
| Home + today focus LLM | `app/api/patient/home/route.ts` |
| Profile weekly LLM + RAG | `src/lib/profileRagInsights.ts`, `app/api/patient/skin-profile/route.ts` |
| Monthly API | `app/api/patient/monthly-insight/route.ts` |
| Cron jobs | `src/lib/cronKaiJobs.ts`, `app/api/cron/kai-*` |
| Retrieval | `src/lib/ragRetrieve.ts`, `src/lib/ragBm25.ts`, `src/lib/ragPinecone.ts` |
| Full RAG narrative | `src/lib/ragKaiTestService.ts` |
| Mobile UI | `mobile/components/dashboard/TodayFocusCard.tsx`, `WeeklyReportCard.tsx`, `MonthlyReportCard.tsx` |

---


## 7. Face scan pipeline

```
capture.tsx / scan.tsx
  → MediaPipe / Vision Camera (on-device landmarks)
  → POST /api/capture/preview (optional live hints)
  → FormData → POST /api/scans/submit (async, preferred)
       ↓ 202 + jobId
  ScanJobReadyNotifier polls GET /api/scans/status/:jobId
       ↓ completed
  Local notification + badge → history/[scanId]
  Fallback: POST /api/scan (sync) if queue returns 503
```

**Assets:** `assets/models/face_landmarker.task` (download via `npm run mediapipe:download-model`).

---

## 8. Build, env & deployment

### Required env (`EXPO_PUBLIC_*`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend base URL (**baked at build time**) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Sign-In iOS |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Sign-In Android |
| `EXPO_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED=1` | Disables E2EE in preview builds |
| `EXPO_PUBLIC_IOS_PERSONAL_TEAM=1` | Strips push entitlements for free Apple team |
| `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGNIN=1` | Paid dev account only |

### EAS profiles (`eas.json`)

| Profile | Output | API URL |
|---------|--------|---------|
| `development` | Dev client | From local `.env` |
| `preview` | Android APK | `http://13.234.166.154` |
| `preview-ios` | iOS internal | Same + personal team flags |
| `production` | Android AAB | `http://13.234.166.154` |

### Config plugins (`app.config.js`)

- HTTP cleartext for EC2 IP (iOS ATS + Android)
- `google-services.json` for FCM (if file present)
- `withAllowHttpApi`, `withAndroidHttpApi`
- Optional Personal Team iOS plugin

### Common commands

```bash
cd mobile
npm start                    # Expo dev
eas build --platform android --profile preview
eas build --platform ios --profile preview-ios
```

---

## 9. Issues & bugs found

### User-reported (priority) — audit 2026-05-29

| # | Issue | What happens | Root cause (code) | Fix direction |
|---|-------|--------------|-------------------|---------------|
| **1** | **Journal “time travel” broken on home dashboard** | Cannot tap past dates and see that day’s sleep/stress/hydration/journal; week arrows move the strip but data stays tied to today | `mobile/app/(drawer)/index.tsx`: date chips are plain `View` (not `Pressable`), so `journalDate` / `setJournalDate` are never updated from the UI. `loadJournalForDate()` exists but is unreachable from the strip. Web (`PatientDashboardDesktop.tsx`) uses selectable chips, blocks **future** days, and loads `/api/journal?date=` per selection | Mirror web: tappable chips, `selectedYmd` state, disable future dates, highlight selected day (not only today). Optionally allow unlimited past weeks (mobile currently caps past navigation with `minWeekOffset` ≈ 1 month) |
| **2** | **Profile “Treatment history” opens AI scans, not visits** | Profile card says “clinic visits” but lands on scan list | `profile.tsx` line ~414: `router.push("/(drawer)/history")` → `history/index.tsx` (AI scan reports first). “View all visits” under Last Treatment correctly uses `history/visits` | Change main card to `/(drawer)/history/visits` or split into two links: “Scan reports” vs “Clinic visits” |
| **3** | **Treatment / visit history UX confusing or “broken”** | Mixed expectations; visit detail may feel empty; history stack naming unclear | `history/index.tsx` title “Treatment History” combines **AI scans**, **report voice notes**, and **visit notes** on one long page. Visit detail (`history/visit/[visitId].tsx`) loads **entire** `GET /api/patient/skin-profile` and finds one visit by id — not `GET /api/patient/history` / dedicated visit route. If profile cache is stale, visit can look missing | Add tabs or separate entry points (Scans \| Visits). Dedicated `GET /api/patient/visits/:id` on mobile. Invalidate `CacheKeys.skinProfile` / `CacheKeys.history` when doctor saves visit notes |
| **4** | **Multi-doctor handling inconsistent** | Several doctors in chat, but home feedback / assignment behave as single-doctor | Chat: per-doctor threads + `doctorId` on send (`chat.tsx`) — OK after backend thread fix. Home: `getPatientDoctorSection()` uses **assigned** doctor + merges all `feedbackEntries` without per-doctor filtering on dashboard. Push opens generic chat without `doctorId`. First registered doctor auto-selected in chat home | Per-doctor unread badges; push payload includes `doctorId`; dashboard feedback grouped by doctor; document assigned vs all-clinic doctors |
| **5** | **Doctor portal treatment notes bleed into dashboard** | Visit/treatment text appears on home dashboard, mixed with general feedback | `src/lib/patientDoctorSection.ts`: `doctorFeedback` falls back to **latest `visitNotes.notes`** when care-row feedback is empty. Mobile `DoctorFeedbackSection` on home renders that as general doctor message. Visit notes belong in **visit history**, not dashboard summary | Stop fallback to visit notes for `doctorFeedback`; show visit content only under Profile / History → Visits. Keep dashboard for `doctorFeedbackVoiceNotes` + explicit care feedback only |
| **6** | **Doctor-updated AM/PM routine stale after refresh** | Doctor sets PM routine in portal; mobile pull-to-refresh still shows old/empty AM list | **Backend:** `PATCH /api/doctor/patients/:id/routine-plan` does **not** call `invalidateUserHomeCache()`. **Server:** `GET /api/patient/home` uses Redis `cacheAside(CacheKeys.home(...))`. **Mobile:** `morning-routine.tsx` / `night-routine.tsx` always read/write journal for **`format(new Date())` only** — no `?date=` (web uses `journalTrackerHref`). Home payload is **not** cached in AsyncStorage (only profile screen caches a home snapshot) | Invalidate home cache on routine-plan PATCH; mobile pass selected journal date into routine screens; cache home JSON locally with TTL + etag/`updatedAt` |
| **7** | **Push delivery broken / misleading UI (partially fixed)** | In-app toggle said “on” but no lock-screen alerts; Android OS prompt easy to miss | Toggle removed. Token only registers on sign-in + `PushTokenSync`. Common blockers: missing **FCM V1 on EAS**, bad/missing `google-services.json`, simulator, permission denied | See **§6** failure table; rebuild APK after EAS credentials |
| **8** | **Local cache / fast load underused** | Profile photo refetches; home/history re-hit network often | Profile photo **is** cached on disk (`profilePhoto.ts` → `documentDirectory/profile-photos/`). Scan images use `fetchAuthenticatedScanImage.ts`. **Missing:** home, history, skin-profile, doctor list, visit list, routine plan items — no stale-while-revalidate on dashboard | See **§10 Local caching strategy** below |

### Recently fixed (verify on EC2 + new mobile build)

| Fix | Commit | Notes |
|-----|--------|-------|
| Onboarding queued baseline scan redirected user back to capture | `22214e4` | Server tracks `scan_jobs` as `baselineScanPending`; resume gate allows questionnaire/dashboard while job runs |
| Doctor portal chat wrong thread | `ad4200e` | `ensureDoctorPatientChatThread(patientId, staffId)` |
| Dev/integration copy in patient UI | mobile 2026-05-29 | Removed login/signup “Server: …” footers; Notifications EAS/push toggle; WeeklyReportCard OPENAI/server-key hints |

### Critical / user-visible (technical)

| # | Issue | Impact |
|---|-------|--------|
| 8 | **No live chat on mobile** — `/api/chat/plain/stream` unused | Doctor messages don’t appear until user leaves/reopens chat or waits for 20s home poll |
| 9 | **Push opens generic chat** — `clinic_chat` has no `doctorId` | Tap notification may show wrong/empty doctor thread |
| 10 | **Chat thread cache can show stale empty state** | Old AsyncStorage thread cache may briefly mislead until refetch |
| 11 | **Onboarding scan redirect (fixed server-side)** | Deploy `22214e4` if users still loop to capture after queued baseline |

### Medium

| # | Issue | Impact |
|---|-------|--------|
| 12 | **`POST /api/appointments/reminders/tick` from chat screen** | Side effect on every chat open |
| 13 | **Visit detail loads full skin-profile** | Wasteful; stale cache → “visit not found” |
| 14 | **Wellness screen is placeholder** | Drawer route shows “Coming soon” |
| 15 | **Onboarding `_layout` omits screens** | `kai-intro`, `questionnaire`, `index` not declared in Stack |
| 16 | **Mixed fetch patterns** | Raw `fetch` vs `apiJson` inconsistency |
| 17 | **No pull-to-refresh on chat** | User can’t force reload |
| 18 | **E2EE disabled in EAS** | `EXPO_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED=1` |
| 19 | **Tracker screens allow future dates** | Sleep/hydration/stress allow +1 month forward; web dashboard blocks future journal days |
| 20 | **Routine checklist not date-aware on mobile** | Web links routines with `?date=`; mobile always uses today |

### Low / tech debt

| # | Issue |
|---|-------|
| 21 | `google-services.json` is **gitignored** — download from Firebase locally; use EAS secret `GOOGLE_SERVICES_JSON` for cloud builds; never commit Firebase **service account** JSON |
| 22 | Production EAS uses **HTTP** to EC2 IP — not long-term prod ready |
| 23 | Onboarding welcome video is placeholder |
| 24 | Expo template leftovers (`modal.tsx`, `EditScreenInfo.tsx`) |
| 25 | Duplicate scan submit paths (`/api/scans/submit` + `/api/scan`) |
| 26 | No automated mobile tests |

### Web vs mobile parity reference (journal & routines)

| Behavior | Web (`PatientDashboardDesktop`, `useJournalTrackerDate`) | Mobile today |
|----------|----------------------------------------------------------|--------------|
| Select past day | Chip click → `setSelectedYmd` → load journal | Chips not clickable |
| Block future days | `disabled={d.isFuture}` | Future week visible; trackers allow future edits |
| AM/PM routine for selected day | `journalTrackerHref(path, selectedYmd)` | Always `new Date()` in `morning-routine.tsx` / `night-routine.tsx` |
| Doctor feedback vs visit notes | Same backend merge issue | Same `DoctorFeedbackSection` on home |

**Key files:** `mobile/app/(drawer)/index.tsx`, `mobile/app/(drawer)/profile.tsx`, `mobile/app/(drawer)/history/*`, `mobile/app/(drawer)/morning-routine.tsx`, `mobile/app/(drawer)/night-routine.tsx`, `src/lib/patientDoctorSection.ts`, `app/api/doctor/patients/[patientId]/routine-plan/route.ts`, `app/api/patient/home/route.ts`

---

## 10. How to make it better

### Journal time travel (match web — **top user priority**)

1. Make date chips **Pressable**; set `journalDate` / `selectedYmd` on tap.
2. **Disable future dates** on chips (and align tracker screens — remove +1 month forward on sleep/stress/hydration).
3. Reload journal fields + dashboard cards from `GET /api/journal?date=` when date changes; show selected date label (“Viewing Mon 12 May”).
4. Pass selected date into AM/PM routine routes (query param or shared context) — mirror `journalTrackerHref` on web.
5. Allow navigating further into the past (web has no hard 1-month floor on week offset).

### Navigation & clinical content separation

6. Profile “Treatment history” → **`/(drawer)/history/visits`** (or rename card to “Scan reports” if keeping `history/index`).
7. Remove `visitNotes.notes` fallback from dashboard `doctorFeedback` (backend + mobile `DoctorFeedbackSection`).
8. Tabbed history: **Scans** \| **Clinic visits** \| **Audio notes** instead of one scrolling page.

### Routine & cache invalidation

9. **`invalidateUserHomeCache(patientId)`** after doctor `routine-plan` PATCH (and visit-notes write if applicable).
10. Mobile: cache `GET /api/patient/home` in AsyncStorage with `{ data, fetchedAt, homeDateYmd }`; stale-while-revalidate on dashboard focus (like profile).
11. On pull-to-refresh, bypass or bust client cache; consider `Cache-Control: no-store` on mobile home fetch.

### Local caching strategy (disk + memory)

Goal: **show cached data instantly**, refresh in background, **skip network** when nothing changed.

| Asset | Store where | Already? | Recommendation |
|-------|-------------|----------|----------------|
| Auth token | SecureStore | Yes | Keep |
| Profile JSON | AsyncStorage `@skf_cache:{userId}:profile` | Yes | Add TTL + invalidate on profile PATCH |
| Home dashboard | — | **No** | Cache `@skf_cache:{userId}:home` with 5–15 min TTL; invalidate on focus if stale |
| Skin profile / visits list | — | Partial (profile screen only) | Cache skin-profile + history payloads; key by userId |
| Profile photo | `documentDirectory/profile-photos/{userId}.jpg` | Yes | After upload, write immediately; compare `ETag` or `updatedAt` from API before re-download |
| Scan report images | `cacheDirectory/scan-img-*` + in-memory Map | Yes | Keep; add LRU cap (e.g. 50 MB) |
| Chat threads | AsyncStorage `skinfit-chat-thread-v1:*` | Yes | Invalidate on push / SSE; TTL 5 min |
| Chat home doctor list | AsyncStorage `skinfit-chat-home-v2` | Yes | Refresh on focus |
| Doctor avatars (chat) | — | No | Cache URLs from `/api/chat/doctor-profile` under `cacheDirectory/doctor-avatars/` |
| Visit attachments | `cacheDirectory/attachments/` | On share only | Pre-cache PDF/image attachments when opening visit detail |
| Routine plan text (`amItems` / `pmItems`) | Inside home cache | — | Must refresh when doctor edits plan (server cache bust) |

**Pattern to adopt everywhere:** stale-while-revalidate — render cache → fetch → if JSON unchanged (hash or `updatedAt`), skip UI flash.

**Do not cache:** secrets, one-time tokens, SOS payloads with sensitive context.

### Instant sync (chat)

12. **Add SSE** on mobile chat while thread open — `/api/chat/plain/stream`.
13. **`useFocusEffect`** on chat thread + invalidate cache on push.
14. Push payload: `{ type: "clinic_chat", doctorId }`.

### UX polish

15. Pull-to-refresh on chat, history, visits.
16. Optimistic chat sends.
17. Offline banner when showing cached data.
18. Skeleton loaders on home/profile.

### Code quality

19. Standardize on `apiJson` / `apiFetch`.
20. Remove `appointments/reminders/tick` from chat screen.
21. `GET /api/patient/visits/:id` for visit detail.

### Security & prod readiness

22. HTTPS + custom domain.
23. Re-enable E2EE doctor chat on mobile when ready.

---

## 11. Suggested features to implement

### Near-term (clinic app essentials)

| Feature | Why |
|---------|-----|
| **Journal time travel on home** | #1 user pain — match web date strip + per-day journal |
| Live doctor chat (SSE) | Core messaging expectation |
| Push deep links to doctor thread | Fixes notification → empty chat |
| Split history: scans vs clinic visits | Fixes profile/history confusion |
| Routine sync after doctor portal edit | Cache invalidation + date-aware routines |
| Appointment push handling | Open schedules / specific appointment |
| HTTPS + custom domain | Production requirement |

### Medium-term (engagement)

| Feature | Why |
|---------|-----|
| Full wellness hub | Replace placeholder; sync sleep/stress/hydration with web |
| Treatment plan view | Show doctor-prescribed routines in one place |
| Medication / product reminders | Local notifications from schedule API |
| Scan comparison slider | Before/after between two scan IDs |
| Share report PDF | Already partially built (`scanReportPdf.ts`) — expose in UI consistently |
| In-app appointment booking | Slot picker using `/api/doctor-slots` pattern from web |

### Long-term (differentiation)

| Feature | Why |
|---------|-----|
| Offline-first journal | Write locally, sync when online; per-day identity |
| On-device asset cache layer | Unified disk cache for photos, reports, avatars (see §10) |
| Widget (iOS/Android) | Today’s focus / next appointment |
| Apple Health / Google Fit sync | Sleep, hydration auto-import |
| Video visit link | Telehealth integration |
| Multi-language | If clinic expands regions |
| E2EE doctor chat on mobile | Match web security story |

---

## Quick reference — files to know

| Concern | File(s) |
|---------|---------|
| Routes | `mobile/app/**` |
| API client | `mobile/lib/api.ts`, `apiBase.ts` |
| Auth | `mobile/contexts/AuthContext.tsx` |
| Cache | `mobile/lib/apiCache.ts`, `chat.tsx` |
| Push | `mobile/lib/pushNotifications.ts`, `PushTokenSync.tsx`, `notificationBehavior.ts` |
| kAI insights UI | `TodayFocusCard.tsx`, `WeeklyReportCard.tsx`, `MonthlyReportCard.tsx` |
| kAI backend | `app/api/patient/home/route.ts`, `skin-profile/route.ts`, `monthly-insight/route.ts`, `src/lib/profileRagInsights.ts`, `src/lib/ragRetrieve.ts` |
| Scan submit | `mobile/lib/submitFaceScan.ts`, `ScanJobReadyNotifier.tsx` |
| Build config | `mobile/app.config.js`, `eas.json`, `app.json` |

---

## Backend endpoints available but unused by mobile

Useful for future mobile work:

- `GET /api/chat/plain/stream` — live chat
- `GET /api/patient/rag-kai-insights` — kAI insights (web dashboard)
- `GET /api/patient/skin-identity` — dedicated skin identity
- `GET /api/reminders` — reminder list
- `POST /api/scans/:id/share-email` — email report
- `GET /api/patient/schedule-bell` — schedule notification state

---

*For server-side chat thread resolution, see `src/lib/doctorPatientCare.ts` and `src/lib/patientDoctorChatThread.ts`. For nginx/EC2 deploy, see `nginx/README.md`.*
