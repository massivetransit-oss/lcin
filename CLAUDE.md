# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build; treat this as the test suite, since there is no test runner configured
- `npm run lint` — Oxlint
- `npm run preview` — serve the production build locally

There is no test framework in this project. Verify changes with `npm run build` (type errors fail the build) and by exercising the feature in the browser.

## Environment variables

Required in `.env` (see `.env.example`), all consumed via `import.meta.env.*` and typed in `src/vite-env.d.ts`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — project `nqnfuyyjlwgzbctumxxv` ("Localized Curricullum in BP")
- `VITE_KAKAO_MAP_KEY` — Kakao Maps JavaScript key; the Kakao app must have the 카카오맵(Maps) product enabled and both `http://localhost:5173` and the production domain registered under 플랫폼 → Web, or `dapi.kakao.com/v2/maps/sdk.js` returns 401/403

**When setting these on Vercel from Windows PowerShell, do not pipe a string into `vercel env add`** (`"value" | vercel env add ...`) — PowerShell's default pipe-to-external-process encoding can prepend a BOM (U+FEFF) to the value. A BOM'd Supabase anon key causes the browser's native `Headers.set()` to throw synchronously inside `@supabase/supabase-js` on *every* request, with no network activity and no useful console error — it silently breaks the entire app in production while working fine locally. Set env vars via the Vercel REST API (`POST /v10/projects/{id}/env` with a JSON body) or verify the deployed bundle has no stray `﻿` before a credential string if this class of bug resurfaces.

## Architecture

This is a client-only Vite + React 19 + TypeScript SPA — **no backend server**. All persistence goes through `@supabase/supabase-js` directly from the browser (Postgres + Storage), configured in `src/lib/supabaseClient.ts`.

### Auth is not Supabase Auth

There's a custom `users` table (`name` unique, `pin` 4-digit, both plain text) instead of Supabase Auth. `src/lib/auth.ts` implements combined signup/login: `loginOrSignup(name, pin)` looks up `name`, creates a new row if it doesn't exist, or throws `PIN_MISMATCH` if the PIN doesn't match. Session is just `{id, name}` cached in `localStorage` (key `stamp-tour-session`) and exposed via `AuthProvider`/`useAuth()` in `src/context/AuthContext.tsx`. `src/routes/RequireAuth.tsx` redirects to `/login` when there's no session.

**Row Level Security is intentionally wide open** (`supabase/schema/001_stamp_tour_schema.sql`): `select`/`insert` policies are `using (true)`/`with check (true)` on `users`, `places`, and `visits`, and both Storage buckets (`visit-photos`, `school-logos`) are public with open upload policies. There's no `update`/`delete` policy on anything, so those are blocked by default, but any anon-key holder can read every row (including `users.pin` in plaintext) and insert new rows. This was a deliberate scope decision for a casual/low-stakes app, not an oversight — see `docs/superpowers/specs/2026-07-31-stamp-tour-design.md`.

### Database schema

There's no Supabase CLI / migration history in this repo. `supabase/schema/*.sql` are plain, numbered SQL files kept for reference; they were applied to the live project via the Supabase MCP `apply_migration` tool, not `supabase db push`. If you add schema changes, add a new numbered file and apply it the same way (or via the Supabase dashboard SQL editor) — there's no automated migration pipeline to hook into.

`places` currently holds the 41 public elementary schools in Bupyeong-gu, Incheon (`003_replace_places_with_schools.sql`), geocoded from each school's road address via the Kakao Local address-search API — not the original example rows from the design spec. `004`/`005` add `places.logo_url` and a public `school-logos` Storage bucket for per-school emblem images.

**Updating place data (name/address/coordinates/logo) doesn't require a code change or deploy.** It's plain row data read at runtime, so it can be edited directly in the Supabase dashboard: Table Editor → `places` to edit a row, or Storage → `school-logos` to upload an image and paste its public URL into that row's `logo_url`. Only add a new `supabase/schema/*.sql` file when the *shape* of the data changes (new column, new table, new bucket).

### Data layer (`src/lib/`)

- `places.ts` — `fetchPlaces()`, `fetchPlaceById(id)`; `Place.logo_url` is nullable — `null` means no per-school image has been set yet
- `placeholderLogo.ts` — `PLACEHOLDER_LOGO_URL`, an inline SVG data URI shown in the stamp book when a place has no `logo_url`
- `visits.ts` — `fetchVisitedPlaceIds(userId)`, `fetchVisitsByPlace(placeId)`, `createVisit({userId, placeId, photo, comment})` (uploads to the `visit-photos` bucket, then inserts the row; a duplicate `(user_id, place_id)` insert is caught via Postgres error code `23505` and rethrown as `ALREADY_VISITED`)
- `geolocation.ts` — `getCurrentPosition()`, `distanceMeters(a, b)`, `VISIT_RADIUS_METERS` (100m); a place's check-in form only renders when the browser's geolocation is within this radius
- `kakaoMap.ts` — `loadKakaoMapsSdk()` injects the Kakao SDK `<script>` once and resolves when `kakao.maps.load` fires; `window.kakao` is typed `any` (no official Kakao Maps type defs are installed)

Routes (`src/App.tsx`, all but `/login` wrapped in `RequireAuth`): `/` → `MapPage` (Kakao map, markers colored by visited status), `/places/:id` → `PlaceDetailPage` (geolocation-gated check-in + public visit feed for that place), `/stampbook` → `StampBookPage` (collection progress, swaps to a completion view once every place is visited).

### TypeScript config constraints

`tsconfig.app.json` sets `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` — always use `import type { X }` for type-only imports (mixing type and value imports in one `import` will fail), and avoid TS features that need runtime transformation (enums, parameter-property shorthand in constructors, namespaces). No `strict: true`, so the Supabase client isn't given a generated `Database` type and query results come back loosely typed.

### Deployment

Vercel project `lcin/lcin` (linked via `.vercel/`, gitignored), auto-deploys on push to `master` via the GitHub integration on `massivetransit-oss/lcin`. `vercel.json` rewrites everything to `/index.html` — required for this to be a client-routed SPA (without it, hard-loading/refreshing any route other than `/`, e.g. `/stampbook`, 404s at the edge before React Router ever runs).
