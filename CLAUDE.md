@AGENTS.md

# IG Wrapped

Single-page Next.js 16 / React 19 / Tailwind 4 app. A user uploads their official
Instagram data-export ZIP; it is parsed **entirely in the browser** and shown as a
tabbed dashboard. Optional extras: Supabase email auth + "cloud save" of the parsed
snapshot, and AI summaries/chat via server route handlers.

## Commands

- `npm run dev` — Turbopack dev server on :3000. If it loops with a Turbopack panic
  `Next.js package not found`, delete `.next/dev/cache/turbopack` and restart
  (`npx next dev --webpack` is a fallback).
- `npm run lint` (ESLint 9 + React Compiler rules), `npx tsc --noEmit -p .`, `npm run build`.
- There is no test suite. Verify parser/insights changes by running the real TS
  modules under Node with the project's `jiti` against synthetic exports, and UI
  changes in the browser via **Try Demo Data** or a synthetic ZIP. Never put a
  real export in the repo (`*.zip` and `/private-data` are gitignored).

## Data flow

1. `src/app/page.tsx` (one `"use client"` component) owns all state. Upload →
   `parseInstagramZip` (`src/lib/zipParser.ts`).
2. `zipParser` reads every `.json` entry (skipping `__MACOSX`), decodes Instagram's
   mojibake once (`src/lib/instagramText.ts`), rejects HTML-format / non-Instagram
   ZIPs, then runs the parsers in `src/lib/parsers/` → `ParsedExportData`
   (`src/types/instagram.ts`). Each stage is wrapped so one failure doesn't kill
   the upload.
3. `computeInsightsBundle` (`src/lib/insightsEngine.ts`) builds the `InsightsBundle`
   (`src/types/insights.ts`): identity graph (`identityResolver.ts`,
   `insights/coreAnalytics.ts`, `insights/directDmIndex.ts`), canonical accounts,
   leaderboards, cleanup/Real Ones scores, eras, ads, security, search, etc.
   `advancedInsights.ts` (`enrichInsightsBundle`) fills derived panels.
4. The bundle is stored on `parsed.insights` and persisted in cloud saves.
   `resolveInsightsBundle` reuses it when `version >= INSIGHTS_BUNDLE_VERSION`,
   otherwise recomputes **without the raw files** (loses like/comment attribution,
   heatmap, reply patterns) — so don't bump the version casually.
5. Tabs (`src/components/*Tab.tsx`, ids in `DashboardTabs.tsx`) render from
   `parsedData` + `insights`. Account clicks open `AccountDetailDrawer` via
   `useAccountDetail`.

## Instagram export facts the code relies on

- Text is mojibake: each UTF-8 byte is its own `\u00XX` escape. It is decoded at
  ingestion only — don't add ad-hoc decoding elsewhere. Old cloud saves are
  repaired on load with `repairMojibakeDeep`.
- Big categories are split: `followers_1.json`, `followers_2.json`, …;
  `message_1.json` (newest), `message_2.json`, … per thread folder;
  `post_comments_1.json`, … Always read every part.
- DM inbox folders are `<slug>_<numeric thread id>`; the slug is not reliably the
  username. Relationship files hold exact handles — never strip digits from them.
- Newer exports put the username in `title` and only `href` (`/_u/<name>`) in
  `string_list_data`; many records keep values in `string_map_data`
  (`{ "Time": { timestamp }, "IP Address": { value } }`).
- Exports may be nested under one top-level folder; legacy layouts lack the
  `connections/` and `your_instagram_activity/` prefixes. Match path fragments.

## Invariants

- **Timestamps:** every parsed `timestamp` / `*Timestamp` / `*At` is unix
  **seconds** (`parseTimestamp` normalizes). Only DM samples' `timestamp_ms` are ms.
  Demo data (`src/lib/demoData.ts`) must use the same units and shapes, and passes
  synthetic files (incl. `personal_information.json`) through the real pipeline.
- **Time of day** uses the viewer's local time via `src/lib/timeOfDay.ts`
  (late night = 00:00–04:59).
- **Export owner** is never the literal "You" — resolve it via
  `exportOwnerIdentity.ts`.
- **Presentation Mode** (`usePresentationMode()`) must hide every person name,
  handle, profile link, note, DM preview, search term, IP/device/location shown
  anywhere. Mask names with `redactNameLabel(label, !presentationMode)` from
  `src/lib/dmDisplayLabels.ts`. Share cards and Story Mode hide names by default.
- **Overlays** (`fixed` drawers/modals) render through `createPortal` to
  `document.body`: the tab panel has `backdrop-blur`, which makes it the containing
  block for fixed children.
- **Cloud save** content is decided by `sanitizeParsedForCloudSave` in
  `src/types/analysis.ts`; keep README.md, SUPABASE_SETUP.md and the in-app save
  copy in sync with it.
- Tabs are wrapped in `TabErrorBoundary` so one broken tab doesn't drop the
  parsed export (which only lives in page state).

## Backend

- Env (`.env.local`, see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (missing → local-only mode), `AI_API_KEY`,
  `AI_MODEL`, `AI_BASE_URL` (server-only; OpenAI-compatible chat completions),
  `NEXT_PUBLIC_LINKEDIN_SCHOOL_CONTEXT`.
- `src/app/api/{dm-summary,overview-summary,analysis-chat}/route.ts` call the AI
  provider. Supabase is used from the browser (`src/lib/supabase/client.ts`,
  `src/lib/cloudSave.ts`); RLS in `supabase/schema.sql` scopes rows to the user.
- Next 16 conventions: request interception lives in `src/proxy.ts`
  (`middleware` is deprecated); `error.tsx` receives `error` + `reset`/`unstable_retry`.

## Environment notes

- The repo lives in a OneDrive folder on Windows; `node_modules` are OneDrive
  reparse points. File watching can misbehave — prefer clearing `.next` over
  debugging phantom rebuilds.
- `.claude/launch.json` defines `igwrapped-dev` (Turbopack) and
  `igwrapped-dev-webpack` preview configs.
