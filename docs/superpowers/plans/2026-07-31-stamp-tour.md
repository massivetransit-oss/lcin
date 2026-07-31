# 부평바로알기 스탬프투어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the stamp-tour feature on top of the existing 부평바로알기 scaffold: name+PIN accounts, a Kakao Map showing curated places, GPS-gated photo/comment check-ins, and a stamp book with a completion screen.

**Architecture:** No separate backend. The React app calls Supabase (Postgres + Storage) directly via `@supabase/supabase-js`. A custom `users` table (name + 4-digit PIN) replaces Supabase Auth; the logged-in session is just `{id, name}` cached in `localStorage`. Routing is client-side via `react-router-dom`.

**Tech Stack:** React 19, TypeScript, Vite, `@supabase/supabase-js`, `react-router-dom`, Kakao Maps JavaScript SDK.

## Global Constraints

- Visit radius: 100 meters (`VISIT_RADIUS_METERS`)
- PIN: exactly 4 digits, stored and queried as plain text — accepted trade-off per spec (no Supabase Auth, no hashing)
- `users.name` must be unique; mismatched PIN on an existing name is an error, not a new account
- `visits` unique on `(user_id, place_id)` — one stamp per place per person, no re-visits
- Comments/photos are public per place (visible to all logged-in users)
- No admin UI, no comment edit/delete, no PIN recovery — out of scope for this plan
- Initial `places` rows are placeholder examples for Bupyeong-gu, explicitly to be replaced later with verified data
- TypeScript config has `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` — use `import type` for type-only imports, no enums/parameter-properties/namespaces
- Spec: `docs/superpowers/specs/2026-07-31-stamp-tour-design.md`

---

### Task 1: Provision the Supabase schema

**Files:**
- Create: `supabase/schema/001_stamp_tour_schema.sql`

**Interfaces:**
- Produces: tables `users(id, name, pin, created_at)`, `places(id, name, description, address, lat, lng, order_index, created_at)`, `visits(id, user_id, place_id, photo_url, comment, created_at)` with a unique constraint on `visits(user_id, place_id)`; a public Storage bucket `visit-photos`; permissive RLS policies (select/insert only, no update/delete) on all three tables and on `storage.objects` for that bucket.

- [ ] **Step 1: Write the migration SQL**

```sql
create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null,
  created_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  address text not null default '',
  lat double precision not null,
  lng double precision not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  photo_url text not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table users enable row level security;
alter table places enable row level security;
alter table visits enable row level security;

-- No Supabase Auth in this app: policies are intentionally open to anon.
-- This exposes users.pin to anyone with the anon key, which was accepted
-- as a trade-off for this casual, low-stakes service (see design spec).
create policy "public read users" on users for select using (true);
create policy "public insert users" on users for insert with check (true);

create policy "public read places" on places for select using (true);

create policy "public read visits" on visits for select using (true);
create policy "public insert visits" on visits for insert with check (true);

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do nothing;

create policy "public read visit photos" on storage.objects for select
  using (bucket_id = 'visit-photos');

create policy "public upload visit photos" on storage.objects for insert
  with check (bucket_id = 'visit-photos');
```

Save this exact SQL to `supabase/schema/001_stamp_tour_schema.sql`.

- [ ] **Step 2: Apply the migration to the connected Supabase project**

Use the `mcp__supabase__apply_migration` tool with `project_id: nqnfuyyjlwgzbctumxxv`, `name: stamp_tour_schema`, and `query` set to the SQL above.

- [ ] **Step 3: Verify the tables exist**

Use `mcp__supabase__list_tables` with `project_id: nqnfuyyjlwgzbctumxxv`.
Expected: `users`, `places`, `visits` are listed with the columns defined above.

- [ ] **Step 4: Check security advisors**

Use `mcp__supabase__get_advisors` with `project_id: nqnfuyyjlwgzbctumxxv`, `type: security`.
Expected: only advisories about the intentionally-open RLS policies (already understood and accepted) — no unrelated critical issues.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema/001_stamp_tour_schema.sql
git commit -m "feat: provision stamp tour supabase schema"
```

---

### Task 2: Seed example places

**Files:**
- Create: `supabase/schema/002_seed_places.sql`

**Interfaces:**
- Consumes: `places` table from Task 1.
- Produces: 4 example rows in `places`, ordered by `order_index`.

- [ ] **Step 1: Write the seed SQL**

```sql
-- Placeholder examples for Bupyeong-gu, Incheon. Coordinates are
-- approximate and must be verified/replaced before real launch.
insert into places (name, description, address, lat, lng, order_index) values
('부평역', '수도권 지하철 1호선/인천 지하철 1호선 환승역', '인천 부평구 부평동', 37.4893, 126.7241, 1),
('부평시장', '부평의 대표 전통시장', '인천 부평구 부평동', 37.4908, 126.7238, 2),
('부평문화의거리', '젊음의 거리로 불리는 상업/문화 거리', '인천 부평구 부평동', 37.4886, 126.7228, 3),
('부평공원', '부평구를 대표하는 도심 공원', '인천 부평구 부평동', 37.4938, 126.7263, 4);
```

Save to `supabase/schema/002_seed_places.sql`.

- [ ] **Step 2: Apply via the Supabase MCP**

Use `mcp__supabase__apply_migration` with `project_id: nqnfuyyjlwgzbctumxxv`, `name: seed_stamp_tour_places`, `query` set to the SQL above.

- [ ] **Step 3: Verify the rows exist**

Use `mcp__supabase__execute_sql` with `project_id: nqnfuyyjlwgzbctumxxv`, `query: select count(*) from places;`
Expected: count is `4`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema/002_seed_places.sql
git commit -m "feat: seed example stamp tour places"
```

---

### Task 3: Auth session layer, route guard, and login screen

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/context/AuthContext.tsx`
- Create: `src/routes/RequireAuth.tsx`
- Create: `src/pages/LoginPage.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.ts`; `users` table from Task 1.
- Produces: `Session` type and `getSession()`, `clearSession()`, `loginOrSignup(name, pin): Promise<Session>` from `src/lib/auth.ts`; `AuthProvider` and `useAuth(): { session: Session | null; login(name, pin): Promise<void>; logout(): void }` from `src/context/AuthContext.tsx`; `RequireAuth` component from `src/routes/RequireAuth.tsx`; `LoginPage` component; routes `/login` and `/` (placeholder) wired in `App.tsx`.

- [ ] **Step 1: Install react-router-dom**

```powershell
npm install react-router-dom
```

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
import { supabase } from './supabaseClient'

export type Session = {
  id: string
  name: string
}

const SESSION_KEY = 'stamp-tour-session'

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function loginOrSignup(name: string, pin: string): Promise<Session> {
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id, name, pin')
    .eq('name', name)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  if (existing) {
    if (existing.pin !== pin) {
      throw new Error('PIN_MISMATCH')
    }
    const session = { id: existing.id, name: existing.name }
    saveSession(session)
    return session
  }

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({ name, pin })
    .select('id, name')
    .single()

  if (insertError) throw new Error(insertError.message)

  const session = { id: created.id, name: created.name }
  saveSession(session)
  return session
}
```

- [ ] **Step 3: Create `src/context/AuthContext.tsx`**

```typescript
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { getSession, loginOrSignup, clearSession } from '../lib/auth'
import type { Session } from '../lib/auth'

type AuthContextValue = {
  session: Session | null
  login: (name: string, pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession())

  async function login(name: string, pin: string) {
    const newSession = await loginOrSignup(name, pin)
    setSession(newSession)
  }

  function logout() {
    clearSession()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Create `src/routes/RequireAuth.tsx`**

```typescript
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 5: Create `src/pages/LoginPage.tsx`**

```typescript
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(name, pin)
      navigate('/')
    } catch (err) {
      if (err instanceof Error && err.message === 'PIN_MISMATCH') {
        setError('이름 또는 PIN이 올바르지 않습니다')
      } else {
        setError('로그인에 실패했습니다')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>부평바로알기</h1>
      <label>
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        PIN (4자리)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">시작하기</button>
    </form>
  )
}
```

- [ ] **Step 6: Replace `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 7: Replace `src/App.tsx`**

```typescript
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RequireAuth } from './routes/RequireAuth'
import { useAuth } from './context/AuthContext'

function HomePlaceholder() {
  const { session, logout } = useAuth()
  return (
    <div>
      <p>환영합니다, {session?.name}님</p>
      <button onClick={logout}>로그아웃</button>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePlaceholder />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
```

- [ ] **Step 8: Verify the build passes**

Run: `npm run build`
Expected: no TypeScript or build errors.

- [ ] **Step 9: Verify in the browser (claude-in-chrome)**

Start `npm run dev`, navigate to `http://localhost:5173/`.
Expected flow:
1. Redirected to `/login` (no session yet).
2. Enter a new name + 4-digit PIN, submit → redirected to `/` showing "환영합니다, {name}님".
3. Reload the page → still logged in (session persisted via localStorage).
4. Click 로그아웃 → redirected to `/login`.
5. Log back in with the same name but a wrong PIN → "이름 또는 PIN이 올바르지 않습니다" shown, not logged in.
6. Log in again with the correct PIN → succeeds.

Stop the dev server after verifying.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/auth.ts src/context/AuthContext.tsx src/routes/RequireAuth.tsx src/pages/LoginPage.tsx src/main.tsx src/App.tsx
git commit -m "feat: add name+pin auth and login screen"
```

---

### Task 4: Places data layer, Kakao Map, and place detail stub

**Files:**
- Create: `src/lib/places.ts`
- Create: `src/lib/visits.ts`
- Create: `src/lib/kakaoMap.ts`
- Create: `src/pages/MapPage.tsx`
- Create: `src/pages/PlaceDetailPage.tsx` (stub, replaced fully in Task 5)
- Modify: `src/vite-env.d.ts`
- Modify: `.env`, `.env.example`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` session from Task 3; `places` table from Tasks 1–2.
- Produces: `Place` type, `fetchPlaces(): Promise<Place[]>`, `fetchPlaceById(id): Promise<Place>` from `src/lib/places.ts`; `fetchVisitedPlaceIds(userId): Promise<Set<string>>` from `src/lib/visits.ts`; `loadKakaoMapsSdk(): Promise<void>` from `src/lib/kakaoMap.ts`; routes `/` → `MapPage`, `/places/:id` → `PlaceDetailPage`.

- [ ] **Step 1: Get a Kakao Maps JavaScript key**

This step needs the human partner. Ask them to:
1. Sign in at https://developers.kakao.com
2. 내 애플리케이션 → 애플리케이션 추가하기, give it any name, create it.
3. Open the app → 앱 키 메뉴 → copy the **JavaScript 키**.
4. Open 플랫폼 메뉴 → Web 플랫폼 등록 → add site domains `http://localhost:5173` and `https://lcin.vercel.app` (Kakao Maps only works on registered domains).

Wait for the key before continuing.

- [ ] **Step 2: Add the key to env files**

Append to `.env` (real value from Step 1):
```
VITE_KAKAO_MAP_KEY=<the JavaScript key>
```

Append to `.env.example`:
```
VITE_KAKAO_MAP_KEY=
```

- [ ] **Step 3: Add the key to Vercel and redeploy**

```powershell
"<the JavaScript key>" | vercel env add VITE_KAKAO_MAP_KEY production --token $env:VERCEL_TOKEN
"<the JavaScript key>" | vercel env add VITE_KAKAO_MAP_KEY preview --token $env:VERCEL_TOKEN
"<the JavaScript key>" | vercel env add VITE_KAKAO_MAP_KEY development --token $env:VERCEL_TOKEN
```

(Redeploy happens at the end of this plan once all tasks are committed and pushed.)

- [ ] **Step 4: Extend `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_KAKAO_MAP_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 5: Create `src/lib/places.ts`**

```typescript
import { supabase } from './supabaseClient'

export type Place = {
  id: string
  name: string
  description: string
  address: string
  lat: number
  lng: number
  order_index: number
}

export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, description, address, lat, lng, order_index')
    .order('order_index', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Place[]
}

export async function fetchPlaceById(id: string): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, description, address, lat, lng, order_index')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Place
}
```

- [ ] **Step 6: Create `src/lib/visits.ts`**

```typescript
import { supabase } from './supabaseClient'

export async function fetchVisitedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('visits')
    .select('place_id')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return new Set(data.map((row) => row.place_id as string))
}
```

- [ ] **Step 7: Create `src/lib/kakaoMap.ts`**

```typescript
declare global {
  interface Window {
    kakao: any
  }
}

let loadPromise: Promise<void> | null = null

export function loadKakaoMapsSdk(): Promise<void> {
  if (window.kakao?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_KEY
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다'))
    document.head.appendChild(script)
  })

  return loadPromise
}
```

- [ ] **Step 8: Create `src/pages/MapPage.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadKakaoMapsSdk } from '../lib/kakaoMap'
import { fetchPlaces } from '../lib/places'
import { fetchVisitedPlaceIds } from '../lib/visits'
import { useAuth } from '../context/AuthContext'

export function MapPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const [places, visitedIds] = await Promise.all([
          fetchPlaces(),
          session ? fetchVisitedPlaceIds(session.id) : Promise.resolve(new Set<string>()),
        ])

        if (cancelled) return
        await loadKakaoMapsSdk()
        if (cancelled || !mapRef.current) return

        const kakao = window.kakao
        const center =
          places.length > 0
            ? new kakao.maps.LatLng(places[0].lat, places[0].lng)
            : new kakao.maps.LatLng(37.4893, 126.7241)
        const map = new kakao.maps.Map(mapRef.current, { center, level: 4 })

        places.forEach((place) => {
          const position = new kakao.maps.LatLng(place.lat, place.lng)
          const marker = new kakao.maps.Marker({ position, map })
          const visited = visitedIds.has(place.id)
          const overlay = new kakao.maps.CustomOverlay({
            position,
            yAnchor: 2.2,
            content: `<div style="padding:2px 6px;border-radius:4px;font-size:12px;background:${
              visited ? '#2f9e44' : '#495057'
            };color:white;">${place.name}</div>`,
          })
          overlay.setMap(map)
          kakao.maps.event.addListener(marker, 'click', () => {
            navigate(`/places/${place.id}`)
          })
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '지도를 불러오지 못했습니다')
        }
      }
    }

    setup()
    return () => {
      cancelled = true
    }
  }, [session, navigate])

  return (
    <div>
      <h1>부평바로알기</h1>
      {error && <p role="alert">{error}</p>}
      <div ref={mapRef} style={{ width: '100%', height: '70vh' }} />
    </div>
  )
}
```

- [ ] **Step 9: Create the `PlaceDetailPage` stub at `src/pages/PlaceDetailPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPlaceById } from '../lib/places'
import type { Place } from '../lib/places'

export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [place, setPlace] = useState<Place | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetchPlaceById(id)
      .then(setPlace)
      .catch((err) => setError(err instanceof Error ? err.message : '장소를 불러오지 못했습니다'))
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!place) return <p>불러오는 중...</p>

  return (
    <div>
      <h1>{place.name}</h1>
      <p>{place.description}</p>
      <p>{place.address}</p>
    </div>
  )
}
```

- [ ] **Step 10: Update `src/App.tsx`**

Replace the whole file:

```typescript
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { RequireAuth } from './routes/RequireAuth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MapPage />
          </RequireAuth>
        }
      />
      <Route
        path="/places/:id"
        element={
          <RequireAuth>
            <PlaceDetailPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
```

- [ ] **Step 11: Verify the build passes**

Run: `npm run build`
Expected: no TypeScript or build errors.

- [ ] **Step 12: Verify in the browser (claude-in-chrome)**

Start `npm run dev`, log in, land on `/`.
Expected: the Kakao map renders with 4 markers (labels visible). Click a marker → navigates to `/places/:id` showing that place's name/description/address.

Stop the dev server after verifying.

- [ ] **Step 13: Commit**

```bash
git add .env.example .gitignore src/lib/places.ts src/lib/visits.ts src/lib/kakaoMap.ts src/pages/MapPage.tsx src/pages/PlaceDetailPage.tsx src/vite-env.d.ts src/App.tsx
git commit -m "feat: add kakao map with place markers"
```

(`.env` stays untracked — do not `git add` it.)

---

### Task 5: Geolocation gating and check-in (photo + comment)

**Files:**
- Create: `src/lib/geolocation.ts`
- Modify: `src/lib/visits.ts`
- Modify: `src/pages/PlaceDetailPage.tsx` (replaces the Task 4 stub)

**Interfaces:**
- Consumes: `Place`, `fetchPlaceById` from Task 4; `useAuth()` from Task 3.
- Produces: `Coordinates` type, `VISIT_RADIUS_METERS`, `getCurrentPosition(): Promise<Coordinates>`, `distanceMeters(a, b): number` from `src/lib/geolocation.ts`; `Visit` type, `fetchVisitsByPlace(placeId): Promise<Visit[]>`, `createVisit(params): Promise<void>` from `src/lib/visits.ts`.

- [ ] **Step 1: Create `src/lib/geolocation.ts`**

```typescript
export type Coordinates = {
  lat: number
  lng: number
}

export const VISIT_RADIUS_METERS = 100

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('GEOLOCATION_DENIED')),
    )
  })
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusMeters = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h))
}
```

- [ ] **Step 2: Extend `src/lib/visits.ts`**

Append to the existing file (keep `fetchVisitedPlaceIds` as-is):

```typescript
export type Visit = {
  id: string
  user_id: string
  place_id: string
  photo_url: string
  comment: string
  created_at: string
  users: { name: string }
}

export async function fetchVisitsByPlace(placeId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('id, user_id, place_id, photo_url, comment, created_at, users(name)')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as Visit[]
}

export async function createVisit(params: {
  userId: string
  placeId: string
  photo: File
  comment: string
}): Promise<void> {
  const ext = params.photo.name.split('.').pop() ?? 'jpg'
  const path = `${params.placeId}/${params.userId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('visit-photos')
    .upload(path, params.photo)

  if (uploadError) throw new Error(uploadError.message)

  const { data: publicUrlData } = supabase.storage.from('visit-photos').getPublicUrl(path)

  const { error: insertError } = await supabase.from('visits').insert({
    user_id: params.userId,
    place_id: params.placeId,
    photo_url: publicUrlData.publicUrl,
    comment: params.comment,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      throw new Error('ALREADY_VISITED')
    }
    throw new Error(insertError.message)
  }
}
```

- [ ] **Step 3: Replace `src/pages/PlaceDetailPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPlaceById } from '../lib/places'
import type { Place } from '../lib/places'
import { createVisit, fetchVisitsByPlace } from '../lib/visits'
import type { Visit } from '../lib/visits'
import { distanceMeters, getCurrentPosition, VISIT_RADIUS_METERS } from '../lib/geolocation'
import { useAuth } from '../context/AuthContext'

export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [place, setPlace] = useState<Place | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [distance, setDistance] = useState<number | null>(null)
  const [locationError, setLocationError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const alreadyVisited = session ? visits.some((v) => v.user_id === session.id) : false

  async function loadPlaceAndVisits(placeId: string) {
    const [placeData, visitData] = await Promise.all([
      fetchPlaceById(placeId),
      fetchVisitsByPlace(placeId),
    ])
    setPlace(placeData)
    setVisits(visitData)
  }

  useEffect(() => {
    if (!id) return
    loadPlaceAndVisits(id).catch((err) =>
      setError(err instanceof Error ? err.message : '장소를 불러오지 못했습니다'),
    )
  }, [id])

  useEffect(() => {
    if (!place) return
    getCurrentPosition()
      .then((pos) => setDistance(distanceMeters(pos, place)))
      .catch((err) => {
        if (err instanceof Error && err.message === 'GEOLOCATION_DENIED') {
          setLocationError('위치 정보를 허용해주세요')
        } else {
          setLocationError('위치 정보를 사용할 수 없습니다')
        }
      })
  }, [place])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || !id || !photo) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await createVisit({ userId: session.id, placeId: id, photo, comment })
      await loadPlaceAndVisits(id)
      setPhoto(null)
      setComment('')
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_VISITED') {
        setSubmitError('이미 인증한 장소입니다')
      } else {
        setSubmitError('업로드에 실패했습니다. 다시 시도해주세요')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p role="alert">{error}</p>
  if (!place) return <p>불러오는 중...</p>

  const withinRange = distance !== null && distance <= VISIT_RADIUS_METERS

  return (
    <div>
      <h1>{place.name}</h1>
      <p>{place.description}</p>
      <p>{place.address}</p>

      {alreadyVisited && <p>이미 인증 완료</p>}

      {!alreadyVisited && locationError && <p role="alert">{locationError}</p>}

      {!alreadyVisited && !locationError && distance !== null && !withinRange && (
        <p>
          장소 근처에서만 인증 가능합니다 (남은 거리: 약{' '}
          {Math.round(distance - VISIT_RADIUS_METERS)}m)
        </p>
      )}

      {!alreadyVisited && withinRange && (
        <form onSubmit={handleSubmit}>
          <label>
            인증사진
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label>
            코멘트
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          {submitError && <p role="alert">{submitError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? '등록 중...' : '인증하기'}
          </button>
        </form>
      )}

      <h2>다녀간 사람들</h2>
      <ul>
        {visits.map((v) => (
          <li key={v.id}>
            <p>{v.users.name}</p>
            <img src={v.photo_url} alt={`${v.users.name}의 인증사진`} width={120} />
            <p>{v.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: no TypeScript or build errors.

- [ ] **Step 5: Verify in the browser (claude-in-chrome), using Chrome DevTools geolocation override**

Start `npm run dev`, log in, click a marker to open its place detail.

1. Override location far from the place (e.g. 0,0) → expect "장소 근처에서만 인증 가능합니다" with a distance shown, no form.
2. Override location to match the place's exact `lat`/`lng` → expect the photo+comment form to appear.
3. Choose any local image file, add a comment, submit → expect the new visit to appear in "다녀간 사람들" with the photo and comment.
4. Reload the page → expect "이미 인증 완료" instead of the form, with the same visit still listed.
5. Confirm via `mcp__supabase__execute_sql` (`select * from visits;`) that the row exists with a non-null `photo_url`.

Stop the dev server after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geolocation.ts src/lib/visits.ts src/pages/PlaceDetailPage.tsx
git commit -m "feat: add gps-gated check-in with photo and comment"
```

---

### Task 6: Stamp book and completion screen

**Files:**
- Create: `src/pages/StampBookPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `fetchPlaces` (Task 4), `fetchVisitedPlaceIds` (Task 4), `useAuth()` (Task 3).
- Produces: `StampBookPage` component; route `/stampbook`.

- [ ] **Step 1: Create `src/pages/StampBookPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPlaces } from '../lib/places'
import type { Place } from '../lib/places'
import { fetchVisitedPlaceIds } from '../lib/visits'
import { useAuth } from '../context/AuthContext'

export function StampBookPage() {
  const { session } = useAuth()
  const [places, setPlaces] = useState<Place[]>([])
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    Promise.all([fetchPlaces(), fetchVisitedPlaceIds(session.id)])
      .then(([placeList, visited]) => {
        setPlaces(placeList)
        setVisitedIds(visited)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '불러오지 못했습니다'))
  }, [session])

  if (error) return <p role="alert">{error}</p>

  const allCollected = places.length > 0 && places.every((p) => visitedIds.has(p.id))

  if (allCollected) {
    return (
      <div>
        <h1>모든 스탬프를 모았습니다!</h1>
        <Link to="/">지도로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>스탬프북</h1>
      <p>
        {visitedIds.size} / {places.length} 수집
      </p>
      <ul>
        {places.map((place) => (
          <li key={place.id}>
            <Link to={`/places/${place.id}`}>
              {place.name} {visitedIds.has(place.id) ? '✅' : '⬜'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Add the import and a new `<Route>` alongside the existing ones:

```typescript
import { StampBookPage } from './pages/StampBookPage'
```

```typescript
      <Route
        path="/stampbook"
        element={
          <RequireAuth>
            <StampBookPage />
          </RequireAuth>
        }
      />
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: no TypeScript or build errors.

- [ ] **Step 4: Verify in the browser (claude-in-chrome)**

Navigate to `/stampbook` while logged in with fewer than 4 places collected.
Expected: progress count (e.g. "1 / 4 수집") and a list with ✅/⬜ per place; clicking a place name navigates to its detail page.

To verify the completion screen without physically visiting every place, insert the remaining visits directly via `mcp__supabase__execute_sql` for the current test user (using an existing photo URL from an earlier visit is fine for this test data), then reload `/stampbook`.
Expected: "모든 스탬프를 모았습니다!" screen replaces the list.

Stop the dev server after verifying.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StampBookPage.tsx src/App.tsx
git commit -m "feat: add stamp book with completion screen"
```

---

### Task 7: Shared navigation and final integration pass

**Files:**
- Create: `src/components/NavBar.tsx`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/PlaceDetailPage.tsx`
- Modify: `src/pages/StampBookPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 3); all page components (Tasks 3–6).
- Produces: `NavBar` component rendered at the top of `MapPage`, `PlaceDetailPage`, and `StampBookPage`.

- [ ] **Step 1: Create `src/components/NavBar.tsx`**

```typescript
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function NavBar() {
  const { session, logout } = useAuth()
  return (
    <nav>
      <Link to="/">지도</Link>
      {' | '}
      <Link to="/stampbook">스탬프북</Link>
      {session && <span> · {session.name}님</span>}
      <button onClick={logout}>로그아웃</button>
    </nav>
  )
}
```

- [ ] **Step 2: Add `<NavBar />` to the top of `MapPage`, `PlaceDetailPage`, and `StampBookPage`**

In each of the three files, import `{ NavBar }` from `'../components/NavBar'` and render `<NavBar />` as the first child of the returned JSX (immediately before the existing `<h1>` or top-level content), for every early-return branch that shows a full page (loading/error states can skip it).

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: no TypeScript or build errors.

- [ ] **Step 4: Full click-through smoke test (claude-in-chrome)**

Start `npm run dev` and walk through: login → map (see NavBar) → click a marker → place detail (see NavBar, submit a check-in if not already done) → NavBar link to 스탬프북 → StampBookPage (see NavBar) → NavBar link back to 지도 → 로그아웃 → redirected to `/login`.
Expected: no console errors at any step, NavBar present and functional on every screen.

Stop the dev server after verifying.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/NavBar.tsx src/pages/MapPage.tsx src/pages/PlaceDetailPage.tsx src/pages/StampBookPage.tsx
git commit -m "feat: add shared navbar across app screens"
```

Push using the same GitHub PAT pattern used earlier in this session (embed it directly in the push URL at execution time — never write the token itself into this file or any committed file):

```powershell
git push "https://$env:GITHUB_PAT@github.com/massivetransit-oss/lcin.git" master:master
```

- [ ] **Step 6: Redeploy to Vercel**

```powershell
vercel --prod --yes --token $env:VERCEL_TOKEN
```

Then verify the production URL (`https://lcin.vercel.app`) in the browser the same way as Step 4.
