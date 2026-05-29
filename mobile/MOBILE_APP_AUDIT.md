# SkinnFit Mobile App — Full Audit & Reference

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

### Registration

- On login: `registerForPushAndSyncToken` → Expo token → `POST /api/user/push-token`
- `PushTokenSync` re-syncs when session restores

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

### Critical / user-visible

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No live chat on mobile** — `/api/chat/plain/stream` unused | Doctor messages don’t appear until user leaves/reopens chat or waits for 20s home poll |
| 2 | **Push opens generic chat** — `clinic_chat` has no `doctorId` | Tap notification may show wrong/empty doctor thread |
| 3 | **Chat thread cache can show stale empty state** | After backend thread fixes, old AsyncStorage cache may briefly mislead until refetch |
| 4 | **Doctor thread bug (backend, fixed)** | Was: doctor portal used wrong thread — deploy `ad4200e` to EC2 if not done |

### Medium

| # | Issue | Impact |
|---|-------|--------|
| 5 | **`POST /api/appointments/reminders/tick` from chat screen** | Unexpected cron side effect; every chat visit triggers server reminder processing |
| 6 | **Visit detail loads full skin-profile** | `GET /api/patient/skin-profile` then finds one visit — wasteful; no dedicated visit API on mobile |
| 7 | **Wellness screen is placeholder** | Drawer route exists but shows “Coming soon” |
| 8 | **Onboarding `_layout` omits screens** | `kai-intro`, `questionnaire`, `index` work via file routing but aren’t declared in Stack — can affect headers/transitions |
| 9 | **Mixed fetch patterns** | Some screens use raw `fetch(getApiBase()+path)` instead of `apiJson` — inconsistent error handling |
| 10 | **No pull-to-refresh on chat** | User can’t manually force reload |
| 11 | **E2EE disabled in EAS** | `EXPO_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED=1` — doctor chat is plaintext on mobile builds |

### Low / tech debt

| # | Issue |
|---|-------|
| 12 | `google-services.json` committed — normal for Android client config; service account JSON must never be committed (gitignored) |
| 13 | Production EAS profile uses **HTTP** not HTTPS — App Store / Play may reject long-term; MITM risk |
| 14 | Onboarding welcome video is a placeholder |
| 15 | `modal.tsx` / `EditScreenInfo.tsx` — Expo template leftovers |
| 16 | Duplicate scan paths (`/api/scans/submit` + `/api/scan`) — intentional fallback but complex |
| 17 | No automated mobile tests in repo |

---

## 10. How to make it better

### Instant sync (highest ROI)

1. **Add SSE or WebSocket to mobile chat** while a thread is open — mirror `app/dashboard/chat/page.tsx` (`EventSource` on `/api/chat/plain/stream?assistantId=&doctorId=`).
2. **`useFocusEffect` on chat thread** — refetch messages every time user opens chat or returns from background.
3. **Invalidate thread cache on push** — when `clinic_chat` notification arrives, clear that thread’s AsyncStorage key and refetch.
4. **Rich push payload** — server sends `{ type: "clinic_chat", doctorId, assistantId }`; mobile opens the correct thread.

### Caching

5. **TTL on chat cache** — e.g. discard if older than 5 minutes.
6. **Extend stale-while-revalidate** to home dashboard and history list (profile already does this well).
7. **Central cache module** — one `useCachedQuery(key, fetcher)` hook instead of per-screen AsyncStorage logic.

### UX polish

8. Pull-to-refresh on chat and notifications.
9. Optimistic message send on mobile (show bubble immediately, mark failed on error).
10. Offline banner: “Showing saved data — reconnect to sync.”
11. Skeleton loaders instead of spinners on home/profile.

### Code quality

12. Standardize on `apiJson` / `apiFetch` everywhere.
13. Remove `appointments/reminders/tick` from chat — run via server cron only (`scripts/install-vm-cron.sh`).
14. Add `GET /api/patient/visits/:id` (or use existing if added) instead of loading full skin-profile for one visit.

### Security & prod readiness

15. Move to **HTTPS + domain** before public launch.
16. Re-enable E2EE for doctor chat when mobile crypto is implemented (web has E2EE helpers in `src/lib/chatE2ee/`).

---

## 11. Suggested features to implement

### Near-term (clinic app essentials)

| Feature | Why |
|---------|-----|
| Live doctor chat (SSE) | Core expectation for messaging app |
| Push deep links to doctor thread | Fixes notification → empty chat |
| Appointment push handling | Open schedules / specific appointment |
| SOS alert deep link | Open doctor chat with urgent flag |
| Biometric app lock | Privacy for health data |
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
| Offline-first journal | Write locally, sync when online |
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
| Push | `mobile/lib/pushNotifications.ts`, `notificationBehavior.ts` |
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
