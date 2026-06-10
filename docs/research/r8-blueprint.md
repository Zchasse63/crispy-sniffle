# Scout R8 "Community + Profile" — Implementation Blueprint

## Patterns & Conventions Found

**Schema provenance trio**: Every user-writable fact must carry `source`, `confidence`, `detail` (seen in `gym_amenities`, `gym_equipment`, `gym_parking`, `gym_transit`). R8 user writes use `source = 'user'`, `confidence = 0.75` as the standard floor. ProvenanceBadge already renders `user` tier with `text-ink/70 bg-paper` tone.

**Migration style**: Each round is one `.sql` file per concern, always `enable row level security` on the new table immediately, then policies in the same file. Table DDL → index → RLS → policies, no triggers except the gyms location trigger. Timestamps are `timestamptz not null default now()`. All UUIDs use `gen_random_uuid()`.

**RLS progression**: Prior rounds are all public-read, zero writes. R8 is the first to open `INSERT` / `UPDATE` / `DELETE` to `authenticated`. The key pattern: `using (auth.uid() = user_id)` for owner-reads, `with check (auth.uid() = user_id)` for owner-writes.

**`@supabase/ssr` 0.12**: `createServerClient` requires `getAll` + `setAll` for middleware (session cookie writes); page/RSC clients can set `setAll: () => {}` as the existing server.ts does. The current server.ts **must be upgraded** to use the service-role key or a proper auth-capable client. There is currently no `middleware.ts` in the project root.

**Zustand stores**: Persist middleware with `skipHydration: true`, rehydrated by `HydrationGate`. R8 adds a new `userStore` on the same pattern. Cloud sync replaces localStorage as source-of-truth post-sign-in — the merge must happen inside the store's `onRehydrateStorage` callback, not in a component.

**Env vars already in use**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key), `SUPABASE_SERVICE_ROLE_KEY` (scripts only). R8 needs no new public vars.

**Component aesthetics** (`rounded-xl border border-paper-line bg-paper-raise p-5`): The `AttributeSection`, `ParkingCard`, `DropInCard`, `HoursDisplay` all share this card shell. All new gym-detail sections must use the same shell.

**`GymDetailPage` layout**: `grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]` — left column is the main content column (Equipment, Recovery, etc.), right sidebar is `<aside>`. Community section goes at bottom of the left column, just before the "Similar spots" grid.

**Scripts pattern**: Node ESM `.mjs`, reads `.env.local` manually, uses `createClient` with service role key. Community-links loader follows this pattern exactly.

**Next.js 16**: App Router, `params` is `Promise<{slug: string}>` awaited in page functions (confirmed by existing `generateMetadata` and page function). Server Actions are available (`"use server"`). No middleware currently exists.

---

## Architecture Decision

**Auth surface**: Supabase magic-link (email OTP only). No password form. A single `<SignInModal>` component triggered from the header. On mobile a dedicated `/me` page handles both the sign-in prompt and the profile portal. Sessions are managed by `@supabase/ssr` via an HTTP-only cookie set by middleware.

**Merge-on-signin strategy**: The existing Zustand stores (`shortlistStore`, `tripStore`) remain the source-of-truth for anonymous users. On auth state change to `SIGNED_IN`, a single `mergeUserData()` async function runs: it reads cloud records, unions them with local store state (cloud wins on conflict), writes the merged set back to cloud, then syncs the Zustand store. This is a one-time merge per session, not a continuous sync — cloud is written on every store mutation post-sign-in via a thin middleware layer in each store action.

**Cloud sync approach**: Extend the three persisted stores (`shortlistStore`, `tripStore`, and a new `visitStore`) with a post-action cloud write when `auth.uid()` is present. Use a `syncQueue` pattern — a module-level queue that batches writes with 300ms debounce. This avoids touching the store interface (no new actions visible to components) and is transparent to the existing UI.

**`fact_confirmations`**: Writes directly to a new `fact_confirmations` table rather than mutating `gym_amenities` / `gym_equipment`. A future moderator review step would promote confirmed facts to the existing provenance tables. This keeps the catalog tables write-protected from users while still capturing the signal.

**`community_links`**: Loaded from `data/community-links.json` into a `community_links` table via `scripts/seed-community-links.mjs`. Public-read, no user writes. Fetched server-side in the gym detail RSC and passed as a prop to a client component for the outbound-link section.

**Review photos**: Stored in a Supabase Storage bucket named `review-photos` with a per-user path prefix `{user_id}/{review_id}/{filename}`. Size limit enforced in storage policy (5 MB per file, 10 files per review). The `review_photos` table records only the storage path, not a public URL — the client constructs the signed or public URL from the path.

**`followed_gyms` folds in alert opt-in**: A single `followed_gyms` table with an `alert_email` boolean column. No separate `alert_subscriptions` table. The Resend integration is future; only the capture mechanism is built now.

**Training prefs**: Stored in `profiles.training_prefs` (jsonb). On sign-in, if `training_prefs` is populated, it calls `filterStore.setFilters()` with the stored segments/vibes — a one-shot prefill, not live binding.

**Nudge computation**: A pure function `computeMembershipNudge(visits: GymVisit[], gym: EnrichedGym): NudgeResult | null` in `src/lib/nudge.ts`. Threshold: 3+ visits to the same gym in the trailing 30 days where `day_pass_price` is known. Returns a display string only; never reads network.

---

## Database DDL

### Migration: `20260610230001_auth_and_community.sql`

```sql
-- ── profiles ──────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  training_prefs  jsonb not null default '{}',
  -- {"segments": ["strength"], "vibes": ["hardcore"]}
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "owner read profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "owner insert profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "owner update profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── gym_visits ────────────────────────────────────────────────────
create table public.gym_visits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  visited_on  date not null,
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index gym_visits_user_idx on public.gym_visits(user_id);
create index gym_visits_gym_idx  on public.gym_visits(gym_id);
alter table public.gym_visits enable row level security;
create policy "owner read visits"
  on public.gym_visits for select to authenticated using (auth.uid() = user_id);
create policy "owner insert visits"
  on public.gym_visits for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update visits"
  on public.gym_visits for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete visits"
  on public.gym_visits for delete to authenticated using (auth.uid() = user_id);

-- ── gym_reviews ───────────────────────────────────────────────────
create table public.gym_reviews (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  comment         text check (char_length(comment) <= 1000),
  visit_context   text check (visit_context in ('member','day_pass','drop_in','class','trial')),
  report_count    integer not null default 0,
  hidden          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (gym_id, user_id)  -- one review per user per gym
);
create index gym_reviews_gym_idx  on public.gym_reviews(gym_id);
create index gym_reviews_user_idx on public.gym_reviews(user_id);
alter table public.gym_reviews enable row level security;
-- Public sees non-hidden reviews; hidden reviews are moderator-only
create policy "public read reviews"
  on public.gym_reviews for select to anon, authenticated
  using (hidden = false);
create policy "owner insert review"
  on public.gym_reviews for insert to authenticated
  with check (auth.uid() = user_id);
create policy "owner update review"
  on public.gym_reviews for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete review"
  on public.gym_reviews for delete to authenticated
  using (auth.uid() = user_id);

-- ── review_photos ─────────────────────────────────────────────────
create table public.review_photos (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.gym_reviews(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,  -- {user_id}/{review_id}/{filename}
  created_at  timestamptz not null default now()
);
create index review_photos_review_idx on public.review_photos(review_id);
alter table public.review_photos enable row level security;
create policy "public read review_photos"
  on public.review_photos for select to anon, authenticated using (true);
create policy "owner insert review_photo"
  on public.review_photos for insert to authenticated
  with check (auth.uid() = user_id);
create policy "owner delete review_photo"
  on public.review_photos for delete to authenticated
  using (auth.uid() = user_id);

-- ── fact_confirmations ────────────────────────────────────────────
-- Users confirm or correct specific amenity/equipment/price facts.
-- These are staging-area suggestions: source='user', confidence=0.75.
-- A future admin flow promotes confirmed facts into gym_amenities/gym_equipment.
create table public.fact_confirmations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  fact_type     text not null check (fact_type in ('amenity','equipment','price','hours')),
  fact_key      text not null,  -- amenity_key / equipment_key / 'day_pass_price' / etc.
  verdict       text not null check (verdict in ('confirm','correct')),
  corrected_value text,  -- only populated when verdict='correct'
  note          text check (char_length(note) <= 280),
  created_at    timestamptz not null default now(),
  unique (user_id, gym_id, fact_type, fact_key)
);
create index fact_confirmations_gym_idx on public.fact_confirmations(gym_id);
alter table public.fact_confirmations enable row level security;
create policy "owner read confirmations"
  on public.fact_confirmations for select to authenticated using (auth.uid() = user_id);
create policy "public count confirmations"
  on public.fact_confirmations for select to anon
  using (true);  -- anon can see counts for credibility display
create policy "owner insert confirmation"
  on public.fact_confirmations for insert to authenticated
  with check (auth.uid() = user_id);
create policy "owner update confirmation"
  on public.fact_confirmations for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── followed_gyms ─────────────────────────────────────────────────
create table public.followed_gyms (
  user_id     uuid not null references auth.users(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  alert_email boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (user_id, gym_id)
);
create index followed_gyms_user_idx on public.followed_gyms(user_id);
alter table public.followed_gyms enable row level security;
create policy "owner read followed"
  on public.followed_gyms for select to authenticated using (auth.uid() = user_id);
create policy "owner insert followed"
  on public.followed_gyms for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update followed"
  on public.followed_gyms for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete followed"
  on public.followed_gyms for delete to authenticated using (auth.uid() = user_id);

-- ── community_links ───────────────────────────────────────────────
create table public.community_links (
  id          uuid primary key default gen_random_uuid(),
  gym_slug    text not null,  -- matches gyms.slug; no FK to allow slug-first queries
  url         text not null,
  title       text not null,
  platform    text not null default 'reddit'
              check (platform in ('reddit','forum','other')),
  year        integer,
  topic_note  text,
  created_at  timestamptz not null default now(),
  unique (gym_slug, url)
);
create index community_links_slug_idx on public.community_links(gym_slug);
alter table public.community_links enable row level security;
create policy "public read community_links"
  on public.community_links for select to anon, authenticated using (true);

-- ── review report function ────────────────────────────────────────
-- Atomically increments report_count and hides at threshold.
create or replace function public.report_review(review_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gym_reviews
  set
    report_count = report_count + 1,
    hidden = case when report_count + 1 >= 3 then true else hidden end,
    updated_at = now()
  where id = review_uuid;
end;
$$;

-- ── trigger: auto-create profile on user sign-up ──────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Storage Bucket Policy (apply via Supabase dashboard or migration)

Bucket name: `review-photos`, public: false.

```sql
-- In a separate migration or via dashboard Storage > Policies:
-- Allow authenticated users to upload to their own prefix
create policy "owner upload review photo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and octet_length(metadata->>'size') <= 5242880  -- 5 MB
  );

create policy "owner delete review photo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public read review photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'review-photos');
```

---

## Component Inventory

### New Files to Create

**`src/middleware.ts`** — Supabase session refresh on every request. Must implement full `getAll` + `setAll` cookie contract. Protects nothing (no redirect guards needed in beta), but is required for token refreshes to persist correctly.

**`src/lib/supabase/server.ts`** (modify) — Upgrade `setAll` from no-op to actual cookie write so RSC contexts can set cookies post-middleware. The current no-op comment says "Beta: no auth, nothing to set" — this must be removed.

**`src/lib/auth.ts`** — Server-side helper `getUser(): Promise<User | null>` and `getSession()`. Used by RSC pages to read current user. Wraps `getServerClient().auth.getUser()`.

**`src/stores/userStore.ts`** — Zustand store (not persisted, session-only) holding `user: User | null`, `isLoading: boolean`, `signIn(email)`, `signOut()`, `setUser(user)`. Subscribes to `supabase.auth.onAuthStateChange` in a `useEffect` hook in `AuthGate`.

**`src/components/auth/AuthGate.tsx`** — Client component, renders in `RootLayout` inside `HydrationGate`. Calls `supabase.auth.onAuthStateChange`, updates `userStore`, triggers merge-on-signin. Renders nothing (null).

**`src/components/auth/SignInModal.tsx`** — Magic-link email form. Steps: email input → "Check your email" confirmation. Uses `getBrowserClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. Styled as a centered modal overlay matching `ShortlistDrawer`'s modal shell.

**`src/components/auth/AuthButton.tsx`** — Header addition. Renders "Sign in" button (opens `SignInModal`) when signed out; renders user avatar/initials + "Me" link when signed in. Drops into `SiteHeader` nav row.

**`src/app/me/page.tsx`** — Server Component that reads user via `getUser()`. If null, renders `<SignInPrompt />`. If authenticated, renders `<ProfilePortal>` with server-fetched initial data for visits, reviews, saved gyms, trips.

**`src/app/me/loading.tsx`** — Skeleton loading state.

**`src/components/profile/ProfilePortal.tsx`** — Client component receiving initial data as props. Tabs: "Log", "Reviews", "Saved", "Trips", "Prefs". Each tab is a separate sub-component.

**`src/components/profile/VisitLog.tsx`** — Lists visits with gym name, date, note. "Log a visit" CTA opens `AddVisitModal`.

**`src/components/profile/AddVisitModal.tsx`** — Date picker (HTML date input), optional note (280 char). Writes to `gym_visits` via client Supabase.

**`src/components/profile/MembershipNudge.tsx`** — Rendered inside `VisitLog`. Calls `computeMembershipNudge()`. Shows nudge banner when threshold met.

**`src/components/profile/SavedGyms.tsx`** — Renders saved gym IDs resolved to `EnrichedGym` rows. Shows "Follow" toggle and alert opt-in per gym.

**`src/components/profile/TrainingPrefs.tsx`** — Segment + vibe multi-select. On save, writes `profiles.training_prefs`. On next sign-in, calls `filterStore.setFilters()`.

**`src/lib/nudge.ts`** — Pure computation. Exported: `computeMembershipNudge(visits, gym) → NudgeResult | null`. Threshold: 3+ visits in trailing 30 calendar days to the same `gym_id` where `day_pass_price` and `monthly_from` are both non-null.

**`src/lib/merge.ts`** — `mergeUserData(userId, client, shortlistStore, tripStore)`. Called once on `SIGNED_IN` event. Algorithm below.

**`src/lib/queries/community.ts`** — `fetchCommunityLinks(client, gymSlug): Promise<CommunityLink[]>`. `fetchGymReviews(client, gymId): Promise<Review[]>`. `fetchFactConfirmations(client, gymId): Promise<FactConfirmation[]>`.

**`src/lib/queries/profile.ts`** — `fetchVisits(client, userId)`, `fetchUserReviews(client, userId)`, `fetchFollowedGyms(client, userId)`.

**`src/components/community/CommunitySection.tsx`** — Renders inside gym detail page left column. Three sub-sections: Reviews, Fact Confirmations, Community Links. Client component for interactivity.

**`src/components/community/ReviewsSection.tsx`** — Lists reviews. "Write a review" button → `ReviewForm` if signed in, "Sign in to review" if not. ProvenanceBadge-style `user` tier shown on each review.

**`src/components/community/ReviewForm.tsx`** — Star picker (1–5), visit context dropdown, comment textarea (1000 char), photo upload (up to 3). All in a single `<form>` with a Server Action OR direct Supabase client write.

**`src/components/community/FactConfirmationRow.tsx`** — Inline row rendered next to each `AttributeItem` for facts of type `amenity`, `price`, or `equipment`. Shows "Still accurate?" + confirm/correct buttons. Only visible to signed-in users. Uses optimistic UI.

**`src/components/community/CommunityLinks.tsx`** — Renders `community_links` rows as `<a target="_blank" rel="noopener noreferrer">` cards. Section title "From the community". Uses `ExternalLink` lucide icon matching existing `<a>` pattern in gym detail.

**`src/components/community/OwnerCTA.tsx`** — Static mailto CTA: `mailto:zchasse89@gmail.com?subject=...`. Renders in a `rounded-xl border border-dashed border-contour-deep/60` shell (matching the thin-data card already in the page).

**`src/components/gym/TrainHereButton.tsx`** — "I trained here" button rendered in the gym detail hero action row alongside Directions/Call/Website/Shortlist. Only visible post-HydrationGate. Signed-out: opens sign-in prompt. Signed-in: opens `AddVisitModal`.

**`scripts/seed-community-links.mjs`** — Reads `data/community-links.json`, upserts to `community_links` via service-role client. Pattern identical to `scripts/seed.mjs`.

### Modify Existing Files

**`src/lib/supabase/server.ts`** — Replace no-op `setAll` with actual cookie setter:
```ts
setAll: (cookies) => {
  try {
    cookies.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    );
  } catch {
    // In RSC context set may throw — safe to swallow post-middleware
  }
},
```

**`src/components/ui/HydrationGate.tsx`** — Add `AuthGate` render and call to `filterStore` prefill after user loads:
```tsx
import { AuthGate } from "@/components/auth/AuthGate";
// Inside return: <AuthGate />{children}
```

**`src/components/SiteHeader.tsx`** — Add `<AuthButton />` to nav row (right of the bookmark button). Add `/me` to `NAV` array.

**`src/app/gym/[slug]/page.tsx`** — Add:
1. Import `fetchCommunityLinks` and pass `gymSlug` to it server-side.
2. Render `<CommunitySection gym={gym} communityLinks={links} />` at the bottom of the left column, before the similar-gyms grid.
3. Add `<TrainHereButton gymId={gym.id} gymName={gym.name} />` to the hero action button row.

**`src/lib/types/database.ts`** — Add table entries for `profiles`, `gym_visits`, `gym_reviews`, `review_photos`, `fact_confirmations`, `followed_gyms`, `community_links`. This file is "GENERATED" but notes hand-edits are acceptable until next regen.

---

## Auth Flow Details

### `src/middleware.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser(); // refreshes session if needed
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### Magic-link OTP flow

`signInWithOtp` with `shouldCreateUser: true` sends a one-time link. The user clicks the link and Supabase redirects to `{origin}/auth/callback?code=...`. A route handler at `src/app/auth/callback/route.ts` exchanges the code for a session via `supabase.auth.exchangeCodeForSession(code)` and redirects to `/me`.

**`src/app/auth/callback/route.ts`**:
```ts
import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const client = await getServerClient();
    await client.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/me`);
}
```

---

## Merge-on-Signin Algorithm

Located in `src/lib/merge.ts`, called from `AuthGate` on `SIGNED_IN` event.

```
mergeUserData(userId, client, shortlistStore, tripStore):
  1. Fetch cloud: followed_gyms rows → cloudSavedIds: string[]
  2. Fetch cloud: trips via a new cloud_trips table (see below) → cloudTrips: Trip[]
  3. localSavedIds = shortlistStore.getState().savedIds
  4. localTrips = tripStore.getState().trips

  Merge saved gyms:
  - Union: mergedIds = [...new Set([...cloudSavedIds, ...localSavedIds])]
  - Upsert all mergedIds as followed_gyms rows (ignore_duplicates: true)
  - shortlistStore.getState().setSavedIds(mergedIds)  [new action needed]

  Merge trips:
  - Cloud trips have a server-generated id; local trips have client-generated id.
  - Deduplicate by (citySlug, startDate, endDate) tuple.
  - cloudTrips take precedence; local-only trips are upserted to cloud.
  - tripStore.getState().setTrips(mergedTrips)  [new action needed]

  5. Load training_prefs from profiles:
  - If training_prefs.segments.length > 0, call filterStore.setFilters(...)

  6. Set a flag in userStore: dataMerged = true (prevents re-run in same session)
```

A `cloud_trips` table is needed to persist trips server-side (the `Trip` type is already defined). This is a new table in the same migration with the same structure as the local Trip shape, plus `user_id`.

**Add to migration**:
```sql
create table public.cloud_trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  city_slug   text not null,
  city_name   text not null,
  start_date  date not null,
  end_date    date not null,
  lodging     jsonb,
  created_at  timestamptz not null default now()
);
create index cloud_trips_user_idx on public.cloud_trips(user_id);
alter table public.cloud_trips enable row level security;
create policy "owner all trips"
  on public.cloud_trips for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## Nudge Computation

`src/lib/nudge.ts`:

```ts
export interface NudgeResult {
  gymName: string;
  visitCount: number;
  spentEstimate: number;  // visitCount * day_pass_price
  membershipFrom: number; // monthly_from
  message: string;
}

const TRAILING_DAYS = 30;
const VISIT_THRESHOLD = 3;

export function computeMembershipNudge(
  visits: Array<{ gym_id: string; visited_on: string }>,
  gym: { id: string; name: string; day_pass_price: number | null; monthly_from: number | null }
): NudgeResult | null {
  if (!gym.day_pass_price || !gym.monthly_from) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRAILING_DAYS);
  const recentVisits = visits.filter(
    v => v.gym_id === gym.id && new Date(v.visited_on) >= cutoff
  );
  if (recentVisits.length < VISIT_THRESHOLD) return null;
  const spent = recentVisits.length * gym.day_pass_price;
  return {
    gymName: gym.name,
    visitCount: recentVisits.length,
    spentEstimate: spent,
    membershipFrom: gym.monthly_from,
    message: `${recentVisits.length} ${gym.name} visits ≈ $${spent.toFixed(0)} in passes this month — membership runs $${gym.monthly_from.toFixed(2)}`,
  };
}
```

---

## Data Flow: Gym Detail Community Section

```
GymDetailPage (RSC)
  ├── fetchGymBySlug(client, slug) → gym
  ├── fetchCommunityLinks(client, slug) → links (0–N rows)
  │
  └── <CommunitySection gym={gym} communityLinks={links} />
        ├── <ReviewsSection gymId={gym.id} />           [client, fetches on mount]
        │     ├── fetchGymReviews(browserClient, gymId)
        │     ├── Maps reviews → review cards w/ star rating + visit context badge
        │     ├── <ReviewForm /> (conditional: signed-in only)
        │     └── "Sign in to leave a review" (signed-out)
        │
        ├── FactConfirmationRows (per AttributeItem, injected by AttributeSection)
        │     └── Writes to fact_confirmations via browserClient.from('fact_confirmations').upsert()
        │
        ├── <CommunityLinks links={links} />             [pure render, no fetch]
        │
        └── <OwnerCTA gymName={gym.name} />
```

The `AttributeSection` component receives a new optional `gymId` prop. When `gymId` is present and user is signed in, each row renders a `<FactConfirmationRow>` inline below the attribute value. This avoids changing `AttributeItem` shape.

---

## Data Flow: /me Profile Portal

```
/me page (RSC)
  ├── getUser() → user | null
  │     if null: render <SignInPrompt /> (static, no fetch)
  │
  └── if user:
        ├── fetchVisits(client, user.id)
        ├── fetchUserReviews(client, user.id)
        ├── fetchFollowedGyms(client, user.id)
        └── <ProfilePortal user={user} initialVisits={...} initialReviews={...} initialFollowed={...} />
              │  [client component, tabs]
              ├── "Log" tab → <VisitLog visits={...} />
              │     └── <MembershipNudge visits={visits} />  [reads gym data from shortlistStore]
              ├── "Reviews" tab → <ReviewHistory reviews={...} />
              ├── "Saved" tab → <SavedGyms gymIds={shortlistStore.savedIds} followed={...} />
              ├── "Trips" tab → existing <TripCard> reused
              └── "Prefs" tab → <TrainingPrefs userId={user.id} />
```

---

## Build Sequence

**Phase 1 — Database foundation (verify: Supabase dashboard shows all tables with correct RLS)**

- [ ] Write migration `20260610230001_auth_and_community.sql` with all DDL above
- [ ] Run `supabase db push` or apply via dashboard
- [ ] Verify `auth.users` trigger creates profile rows
- [ ] Create `review-photos` Storage bucket (public: false) and apply storage policies
- [ ] Write `scripts/seed-community-links.mjs` and run it; verify `community_links` table has 42 rows

**Phase 2 — Auth plumbing (verify: sign-in OTP email arrives; `/auth/callback` sets cookie; `userStore` reflects signed-in state)**

- [ ] Write `src/middleware.ts` (session refresh, full `getAll`+`setAll`)
- [ ] Upgrade `src/lib/supabase/server.ts` `setAll` to real cookie write
- [ ] Write `src/app/auth/callback/route.ts`
- [ ] Write `src/stores/userStore.ts`
- [ ] Write `src/components/auth/AuthGate.tsx` (onAuthStateChange listener)
- [ ] Write `src/components/auth/SignInModal.tsx`
- [ ] Write `src/components/auth/AuthButton.tsx`
- [ ] Modify `src/components/ui/HydrationGate.tsx` (add `<AuthGate />`)
- [ ] Modify `src/components/SiteHeader.tsx` (add `<AuthButton />`, add `/me` nav entry)
- [ ] Update `src/lib/types/database.ts` with new table types

**Phase 3 — Merge and profile data layer (verify: post-sign-in merge runs once; `/me` shows correct data)**

- [ ] Write `src/lib/merge.ts`
- [ ] Write `src/lib/nudge.ts`
- [ ] Write `src/lib/auth.ts`
- [ ] Write `src/lib/queries/profile.ts`
- [ ] Add `setSavedIds` action to `shortlistStore`, `setTrips` action to `tripStore`
- [ ] Wire `mergeUserData` call into `AuthGate` on `SIGNED_IN`
- [ ] Write `src/app/me/page.tsx` and `src/app/me/loading.tsx`
- [ ] Write `src/components/profile/ProfilePortal.tsx` (shell + tabs)
- [ ] Write `src/components/profile/VisitLog.tsx` + `AddVisitModal.tsx`
- [ ] Write `src/components/profile/MembershipNudge.tsx`
- [ ] Write `src/components/profile/SavedGyms.tsx`
- [ ] Write `src/components/profile/TrainingPrefs.tsx`
- [ ] Wire training prefs prefill into `AuthGate`

**Phase 4 — Gym detail community section (verify: reviews load; fact confirmations write; community links appear; owner CTA mailto works)**

- [ ] Write `src/lib/queries/community.ts`
- [ ] Write `src/components/community/CommunitySection.tsx`
- [ ] Write `src/components/community/ReviewsSection.tsx` + `ReviewForm.tsx`
- [ ] Write `src/components/community/FactConfirmationRow.tsx`
- [ ] Write `src/components/community/CommunityLinks.tsx`
- [ ] Write `src/components/community/OwnerCTA.tsx`
- [ ] Write `src/components/gym/TrainHereButton.tsx`
- [ ] Modify `src/components/gym/AttributeSection.tsx` to accept optional `gymId` prop and render `<FactConfirmationRow>` per item
- [ ] Modify `src/app/gym/[slug]/page.tsx` to fetch community links, render `<CommunitySection>`, add `<TrainHereButton>`
- [ ] End-to-end: submit a review, reload page, verify it appears

---

## Critical Details

### RLS Testing

The highest-risk surface is `fact_confirmations` having both an "owner read" (authenticated, `user_id = auth.uid()`) and a separate "public count" policy for anon. PostgREST will union these policies for an authenticated user — this means authenticated users see all rows via the public policy, not just their own. **Fix**: remove the anon count policy; instead expose a `view` or a Postgres function `count_confirmations(gym_id, fact_key)` with `security definer` that returns the count. This avoids leaking who confirmed what to the public.

For `gym_reviews`, the `hidden = false` public read policy means a user cannot see their own hidden review. Add a second select policy: `owner read own reviews: using (auth.uid() = user_id)` so authors can always see their own reviews regardless of hidden state.

### Photo Abuse Limits

The Storage bucket policy checks `octet_length(metadata->>'size')` but Supabase Storage metadata is set by the client — it can be spoofed. The authoritative limit enforcement must be in the Storage bucket's max file size setting (5 MB), configured in the Supabase project dashboard under Storage > Bucket settings, not just in the RLS policy. The RLS policy acts as a defense-in-depth layer only.

Limit photos per review to 3 at the UI layer: `ReviewForm` disables the upload button after 3 files are selected. The database has no hard constraint on this — a future migration can add it if abuse occurs.

### Anonymous-to-Authed Migration Edge Cases

The most dangerous edge case: a user signs out, then signs in on the same browser. The merge algorithm must be idempotent. The `followed_gyms` upsert uses `onConflict: 'user_id,gym_id'` with `ignoreDuplicates: true`. The `cloud_trips` upsert deduplicates on `(user_id, city_slug, start_date, end_date)` with a unique constraint. If a user has 50 locally-saved gyms from anonymous use, the merge will issue 50 individual insert rows to `followed_gyms` — batch this as a single `.upsert(rows)` call.

A second edge case: the auth callback fires on every tab where the user is already signed in (after a refresh). Guard the merge with `userStore.getState().dataMerged` — skip if already true for this session.

### Rating Denormalization

`gyms.rating` and `gyms.rating_count` are currently static (seeded). They need updating when reviews are written. Rather than a trigger (which adds fragility), use a Postgres function `refresh_gym_rating(gym_id uuid)` called from the client after a successful review insert. The function runs `UPDATE gyms SET rating = avg, rating_count = count FROM gym_reviews WHERE gym_id = ... AND hidden = false`. Call this from the browser client after each review insert/update/delete.

```sql
create or replace function public.refresh_gym_rating(gym_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gyms
  set
    rating = (select round(avg(rating)::numeric, 2) from public.gym_reviews
              where gym_id = gym_uuid and hidden = false),
    rating_count = (select count(*) from public.gym_reviews
                    where gym_id = gym_uuid and hidden = false),
    updated_at = now()
  where id = gym_uuid;
end;
$$;
```

This function must be added to the migration.

### Profanity / Length Caps

Caps are enforced by DB `CHECK` constraints (already in DDL above: `comment <= 1000`, `note <= 280`). The UI should show a live character counter (`{remaining} left`) to prevent silent truncation. No server-side profanity filter in R8 — rely on the report mechanism (hidden at 3 reports) as the moderation layer.

### filterStore Prefill from Training Prefs

`filterStore` is session-only (not persisted). Training prefs prefill runs once per sign-in session inside `AuthGate`. The prefill maps `training_prefs.segments` → `FilterSet.preferredSegments` and `training_prefs.vibes` → `FilterSet.preferredVibes`. It does NOT set `FilterSet.segments` (the hard filter) — only soft preferences, consistent with the existing Kodawari rule. The call is `filterStore.getState().setFilters({ ...EMPTY_FILTER_SET, preferredSegments: prefs.segments, preferredVibes: prefs.vibes }, 'fallback')`.

### `@supabase/ssr` 0.12 Cookie Pattern

The `createBrowserClient` singleton in `browser.ts` already handles auth cookies on the client side correctly. The middleware pattern above is the exact pattern required by 0.12 — the two-step where `response` is re-created with `NextResponse.next({ request })` after writing cookies is essential; omitting this causes cookies set in the response to be dropped.

---

## Relevant File Paths

- `/Users/zach/Desktop/Final Scout/scout/supabase/migrations/` — new migration `20260610230001_auth_and_community.sql` goes here
- `/Users/zach/Desktop/Final Scout/scout/src/middleware.ts` — new file at project root's `src/`
- `/Users/zach/Desktop/Final Scout/scout/src/lib/supabase/server.ts` — upgrade `setAll`
- `/Users/zach/Desktop/Final Scout/scout/src/lib/supabase/browser.ts` — no change needed
- `/Users/zach/Desktop/Final Scout/scout/src/lib/auth.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/lib/merge.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/lib/nudge.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/lib/queries/gyms.ts` — no change needed (community is a separate query module)
- `/Users/zach/Desktop/Final Scout/scout/src/lib/queries/community.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/lib/queries/profile.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/lib/types/database.ts` — add new table types
- `/Users/zach/Desktop/Final Scout/scout/src/lib/types/scout.ts` — add `GymVisit`, `Review`, `CommunityLink`, `NudgeResult` interfaces
- `/Users/zach/Desktop/Final Scout/scout/src/stores/userStore.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/stores/shortlistStore.ts` — add `setSavedIds` action
- `/Users/zach/Desktop/Final Scout/scout/src/stores/tripStore.ts` — add `setTrips` action
- `/Users/zach/Desktop/Final Scout/scout/src/components/ui/HydrationGate.tsx` — add `AuthGate`
- `/Users/zach/Desktop/Final Scout/scout/src/components/SiteHeader.tsx` — add `AuthButton`, `/me` nav
- `/Users/zach/Desktop/Final Scout/scout/src/components/auth/AuthGate.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/components/auth/SignInModal.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/components/auth/AuthButton.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/components/gym/AttributeSection.tsx` — add optional `gymId` prop
- `/Users/zach/Desktop/Final Scout/scout/src/components/gym/TrainHereButton.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/components/community/` — new directory, 5 components
- `/Users/zach/Desktop/Final Scout/scout/src/components/profile/` — new directory, 5 components
- `/Users/zach/Desktop/Final Scout/scout/src/app/me/page.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/app/me/loading.tsx` — new
- `/Users/zach/Desktop/Final Scout/scout/src/app/auth/callback/route.ts` — new
- `/Users/zach/Desktop/Final Scout/scout/src/app/gym/[slug]/page.tsx` — add community section + TrainHereButton
- `/Users/zach/Desktop/Final Scout/scout/scripts/seed-community-links.mjs` — new
- `/Users/zach/Desktop/Final Scout/scout/data/community-links.json` — read-only source (no changes)