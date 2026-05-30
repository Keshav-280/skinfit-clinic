# Mobile Audit Implementation Summary

This document summarizes all actionable code fixes implemented from `mobile/MOBILE_APP_AUDIT.md` in this pass.

## Changes made

### 1) Journal time travel + date-aware routines (Section 9 #1, #6)

- `mobile/app/(drawer)/index.tsx`
  - Added selectable date chips for week strip (`Pressable`) with `journalDate` updates.
  - Disabled future date chips and kept unlimited backward/forward week paging.
  - Added selected date label (`Viewing ...`) and highlighted selected day (not just today).
  - Home fetch is now date-aware (`/api/patient/home?date=...`) and uses cached fallback.
  - Routine cards and "View all tasks" now pass `?date=YYYY-MM-DD`.
  - Daily tracker cards now pass `?date=YYYY-MM-DD`.
  - Added offline/cached banner when serving cached home payload.
  - Today focus is shown only for selected current day.

- `mobile/app/(drawer)/morning-routine.tsx`
  - Reads `date` query param.
  - Fetches home for selected date and saves routine steps to selected date journal entry.
  - Displays selected date in header context.

- `mobile/app/(drawer)/night-routine.tsx`
  - Same date-aware behavior as morning routine.

### 2) Profile treatment history route correction (Section 9 #2)

- `mobile/app/(drawer)/profile.tsx`
  - Updated primary "Treatment history" link to `/(drawer)/history/visits` (instead of `/(drawer)/history`).
  - Updated card subtitle to clearly describe visits/notes intent.

### 3) History UX separation + visit detail API (Section 9 #3, Section 10)

- `mobile/app/(drawer)/history/index.tsx`
  - Added clear tab separation: `Scans` | `Visits`.
  - Added cached/offline banner support using local cache.
  - Retained pull-to-refresh.

- `mobile/app/(drawer)/history/visits.tsx`
  - Added cache-backed load (`history-visits`) with offline banner.
  - Uses dedicated visits-only server payload.

- `mobile/app/(drawer)/history/visit/[visitId].tsx`
  - Switched from full `/api/patient/skin-profile` scan to dedicated endpoint.
  - Uses `GET /api/patient/visits/:id`.
  - Added cached fallback banner and pull-to-refresh.

- `app/api/patient/visits/[visitId]/route.ts` (new)
  - Implemented dedicated visit detail route.
  - Authenticated by patient session and scoped to requesting user.

- `app/api/patient/history/route.ts`
  - Added optional `?include=visits` mode for lightweight visits list payload.

### 4) Multi-doctor push deep-linking + thread cache invalidation (Section 9 #4, Section 10)

- `src/lib/expoPush.ts`
  - `notifyPatientNewClinicChat` now accepts optional `doctorId` and includes it in push payload data.

- `src/lib/notificationPushDispatch.ts`
  - Passes through `doctorId` from `doctor.reply` payload to push sender.

- `app/api/doctor/patients/[patientId]/chat/route.ts`
  - Includes `doctorId` in published `doctor.reply` notification payload.

- `src/lib/clinicSupportChat.ts`
  - Supports optional `doctorId` in notification payload for downstream push routing.

- `mobile/lib/notificationBehavior.ts`
  - `clinic_chat` push tap now deep-links to `/(drawer)/chat?doctorId=...` when available.
  - Invalidates local thread/home chat caches on chat push tap.

- `mobile/app/(drawer)/chat.tsx`
  - Accepts `doctorId` from route query and opens that doctor thread directly.
  - Thread cache now stores `{ ts, rows }` with TTL awareness.
  - Clears stale thread caches for non-active threads.
  - Added pull-to-refresh on chat thread.
  - Added cached/offline thread banner.
  - Added optimistic sending for non-AI chat sends.

### 5) Dashboard feedback source fix (Section 9 #5)

- `src/lib/patientDoctorSection.ts`
  - Removed fallback of `doctorFeedback` to latest `visitNotes.notes`.
  - Dashboard doctor feedback now only uses explicit doctor care feedback.

### 6) Routine stale data + cache invalidation (Section 9 #6)

- `app/api/doctor/patients/[patientId]/routine-plan/route.ts`
  - Added `invalidateUserHomeCache(patientId)` after routine updates/clear.

- `app/api/doctor/patients/[patientId]/visit-notes/route.ts`
  - Added invalidations for home and scan-derived caches in addition to history/insights.

### 7) Local cache expansions + stale-while-revalidate behavior (Section 9 #7)

- `mobile/lib/apiCache.ts`
  - Added TTL-friendly helpers:
    - `getCachedEntry`
    - `getCachedFresh`
    - `isCacheStale`

- Applied cache-backed stale-while-revalidate patterns to:
  - `mobile/app/(drawer)/index.tsx` (`home`)
  - `mobile/app/(drawer)/history/index.tsx` (`history`)
  - `mobile/app/(drawer)/history/visits.tsx` (`history-visits`)
  - `mobile/app/(drawer)/history/visit/[visitId].tsx` (`visit:<id>`)

### 8) Section 10 feasible improvements

- Removed chat mount side-effect:
  - `mobile/app/(drawer)/chat.tsx`
    - removed `POST /api/appointments/reminders/tick` trigger on mount.

- Pull-to-refresh implemented or preserved:
  - `mobile/app/(drawer)/chat.tsx` (new thread-level pull-to-refresh)
  - `mobile/app/(drawer)/history/index.tsx` (kept)
  - `mobile/app/(drawer)/history/visits.tsx` (kept)
  - `mobile/app/(drawer)/history/visit/[visitId].tsx` (new)

- Future date blocking for trackers:
  - `mobile/app/(drawer)/sleep-tracker.tsx`
  - `mobile/app/(drawer)/hydration-tracker.tsx`
  - `mobile/app/(drawer)/stress-tracker.tsx`
  - Max date now clamped to today and supports initial `?date=` hydration.

- Push deep link doctorId in notification behavior:
  - `mobile/lib/notificationBehavior.ts` (implemented).

- GET `/api/patient/visits/:id` usage:
  - Implemented backend route and migrated visit detail screen.

### 9) SSE chat stream support on mobile (Section 10)

- `app/api/chat/plain/stream/route.ts`
  - Extended auth support to accept `?token=` JWT (mobile-compatible stream access path).

- `mobile/app/(drawer)/chat.tsx`
  - Added stream reachability probe against `/api/chat/plain/stream`.
  - If stream endpoint is unavailable in runtime, falls back to periodic sync.
  - Thread auto-sync interval runs while thread is open.

Note: true long-lived native `EventSource` consumption requires runtime support in the app environment. The code now mirrors server stream access path and uses it as the preferred capability check, with safe fallback syncing.

### 10) AI scan debug preview toggle

- `mobile/components/ScanCaptureDebugOverlay.tsx`
  - Added support for `EXPO_PUBLIC_SCAN_DEBUG_PREVIEW=1` to force-enable debug preview overlay.

- `mobile/.env.example`
  - Documented `EXPO_PUBLIC_SCAN_DEBUG_PREVIEW=1`.

## Why these changes

- To resolve the highest user-reported blockers: date travel on home, visit/history navigation confusion, stale routine/dashboard state, and multi-doctor notification routing.
- To make mobile behavior match existing web/backend capabilities where practical (date-aware routine links, clearer history separation, dedicated visit fetch).
- To improve perceived reliability in poor network conditions by showing cached data immediately and surfacing offline/cached context.
- To remove side effects from passive screen opens and make thread updates more deterministic.

## Requires your permission / action

These items are outside pure code changes and require environment/deployment/ops action:

- **EAS / FCM credentials**
  - Upload Android FCM V1 service account in Expo EAS credentials.
  - Rebuild preview/production binaries after credential updates.
- **EC2 deploy**
  - Deploy updated backend routes and notification payload changes to EC2.
  - Restart app workers/background jobs handling notification events.
- **Environment variables**
  - Confirm production `OPENAI_API_KEY` and chosen model envs.
  - Enable/adjust `KAI_MONTHLY_CRON_RAG` and cron schedule if monthly insights are expected.
  - Set `EXPO_PUBLIC_SCAN_DEBUG_PREVIEW=1` in preview build profile when needed.
- **HTTPS / domain**
  - Migrate from HTTP/IP base URL to HTTPS domain for production stability.
- **Pinecone / RAG infra**
  - Configure Pinecone env and index lifecycle if RAG quality is a target.
- **Cron + infra**
  - Ensure monthly/weekly cron jobs run on schedule in production.
- **E2EE re-enable**
  - Re-enable doctor chat E2EE in mobile when operationally ready.

## Not implemented (out of scope or non-trivial without wider refactor)

- Full native always-on SSE event streaming listener with guaranteed mobile runtime compatibility across all Expo targets.
- Complete thread-level cache invalidation keyed by push event IDs (current invalidation is conservative and broader).
- Major redesign of history IA beyond tab separation (e.g., full information architecture and migration of all linked copy).
- Any non-code operational setup tasks (credentials, infrastructure hardening, cron orchestration, DNS/SSL).
- Any git push/commit/deploy actions.
