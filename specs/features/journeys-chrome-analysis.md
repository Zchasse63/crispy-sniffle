# Feature Design Document: journeys-chrome

**Feature slug:** `journeys-chrome`
**Analyst:** qa-analyst (Phase 1)
**Date:** 2026-06-10
**Target URL:** http://localhost:3100
**Live DOM verified:** Yes (all selectors confirmed against running app)

---

## Scope

Eight test surfaces covering user journeys and chrome:
1. Shortlist (GymCard save toggle, header counter, drawer, remove, persistence)
2. /compare (empty state, table with 2+ saved gyms)
3. /trips (add-trip form, trip card, lodging input, remove, persistence)
4. Auth chrome (Sign in button, SignInModal, email validation, close)
5. /me signed-out (sign-in pitch, no crash, no skeleton-forever)
6. Static pages (/blog list, /blog/[slug], /about, /privacy, /terms, /robots.txt, /llms.txt, /sitemap.xml)
7. Footer NewsletterForm (checkboxes default-checked, disable logic, enable on valid email)
8. 404 (/gym/nonexistent-slug-xyz returns not-found UI)

**Non-goals:** actual magic-link delivery, signed-in /me content, voice, near-me geolocation, error boundaries.

---

## Surface 1: Shortlist

### Component tree
- `GymCard` (`src/components/gym/GymCard.tsx`) renders `ShortlistButton` at `absolute right-3 top-3`
- `ShortlistButton` (`src/components/shortlist/ShortlistButton.tsx`) — toggle bookmark button
- `SiteHeader` (`src/components/SiteHeader.tsx`) — bookmark button with count badge
- `ShortlistDrawer` (`src/components/shortlist/ShortlistDrawer.tsx`) — slide-in panel, renders `GymRow` list
- `GymRow` (`src/components/gym/GymRow.tsx`) — compact row with remove button

### Store
- `useShortlistStore` (`src/stores/shortlistStore.ts`)
  - Zustand with `persist` middleware
  - localStorage key: `scout-shortlist-v1`
  - `skipHydration: true` (rehydrated by HydrationGate)
  - Persisted shape: `{ savedIds: string[] }`

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| Save button (unsaved) | `button[aria-label="Save to shortlist"]` | 35 on home page (1 per card) |
| Save button (saved) | `button[aria-label="Remove from shortlist"]` | aria-pressed="true" when saved |
| Header shortlist button | `button[aria-label*="Open shortlist"]` | Full label: "Open shortlist (N saved)" |
| Header count badge | `button[aria-label*="Open shortlist"] span.font-mono` | Appears when count > 0 |
| Shortlist drawer | `[role="dialog"][aria-label="Shortlist"]` | fixed overlay; role=dialog aria-modal |
| Drawer close (X) | `button[aria-label="Close"]` inside drawer header | autoFocus on open |
| Drawer backdrop close | `button[aria-label="Close shortlist"]` | absolute inset-0 backdrop |
| GymRow remove button | `button[aria-label^="Remove "]` | aria-label="Remove {gymName}" |
| GymRow gym link | `a[href^="/gym/"]` inside drawer | links to gym detail |

### Key behaviors
- `toggle()` switches aria-label between "Save to shortlist" ↔ "Remove from shortlist"
- `aria-pressed="true"` when saved
- Header label pattern: `"Open shortlist (N saved)"` — N is exact count
- Count badge (`span.font-mono`) only rendered when `count > 0`
- Drawer fetches gym data from Supabase via `fetchGymsByIds` when opened
- localStorage key: `scout-shortlist-v1` — `{ state: { savedIds: [...] }, version: 0 }`

### Traps to avoid
- The save button is inside an `<a>` tag (GymCard is a Link). Click handler calls `e.preventDefault(); e.stopPropagation()` — do NOT navigate. Use `page.locator('button[aria-label="Save to shortlist"]').first().click()` directly.
- After clicking save, the button's aria-label changes — do NOT reuse stale locators.
- Drawer gym data loads async (~500–1500ms). Use `await expect(locator).toBeVisible()` not raw `.count()`.
- localStorage rehydration: `skipHydration: true` means you must reload the page to see persisted state. Use `page.reload()` then `waitForLoadState`.

---

## Surface 2: /compare

### Component tree
- `ComparePage` (`src/app/compare/page.tsx`) — client component
- `EmptyState` (`src/components/ui/EmptyState.tsx`) — when savedIds < 2
- `CompareTable` (`src/components/compare/CompareTable.tsx`) — table when ≥ 2 saved

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| Page h1 | `h1` with text "Compare" | Always rendered |
| Empty state title | `text="Not enough to compare"` | When < 2 gyms saved |
| Find gyms CTA | `button:has-text("Find gyms")` inside EmptyState | Routes to "/" |
| Compare table | `table` | Rendered only when ≥ 2 gyms |
| Gym name links in thead | `thead a[href^="/gym/"]` | One per gym column |
| Row: Day pass | `th` with text "Day pass" | tbody sticky th |
| Row: Monthly from | `th` with text "Monthly from"` | IMPORTANT: full label is "Monthly from" not "Monthly" |
| Row: Drop-in | `th` with text "Drop-in"` | exact |
| Row: Parking | `th` with text "Parking"` | appears twice (one in basic rows, one... wait — see note) |
| Remove column button | `button:has-text("Remove")` inside thead | Per gym column |

**Note on "Parking":** Confirmed two `th` elements with text containing "Parking" — one is the basic row ("Parking") and one is in the Amenities section ("Parking" amenity key). Use `thead`/`tbody` scoping to disambiguate if needed.

### Workflow to get table: save 2 gyms via localStorage injection
```typescript
// Set shortlist state before navigating to /compare
await page.evaluate(() => {
  localStorage.setItem('scout-shortlist-v1', JSON.stringify({
    state: { savedIds: ['gym-id-1', 'gym-id-2'] },
    version: 0
  }));
});
await page.goto('/compare');
```

**Important:** The page reads `useShortlistStore(s => s.savedIds)` which persists to `scout-shortlist-v1`. The store uses `skipHydration: true` — the `HydrationGate` calls `useShortlistStore.persist.rehydrate()` on mount. Setting localStorage before navigation (in a fresh context) is reliable.

**Better approach for tests:** Save gyms via UI on the home page, then navigate to /compare within the same page context. This avoids needing to know real gym UUIDs.

---

## Surface 3: /trips

### Component tree
- `TripsPage` (`src/app/trips/page.tsx`) — client component
- `EmptyState` — when no trips
- `AddTripModal` (`src/components/trips/AddTripModal.tsx`) — triggered by "Add trip" button
- `TripCard` (`src/components/trips/TripCard.tsx`) — one per trip

### Store
- `useTripStore` (`src/stores/tripStore.ts`)
  - Zustand persist, localStorage key: `scout-trips-v1`
  - `skipHydration: true`

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| Page h1 | `h1` with text "Trips" | |
| Add trip button | `getByRole('button', { name: 'Add trip' })` | Top-right of page header |
| Add trip modal | `[role="dialog"][aria-label="Add trip"]` | |
| City select | `[role="dialog"] select` | Options load from Supabase fetchCities |
| Start date | `[role="dialog"] input[type="date"]` nth(0) | "From" label |
| End date | `[role="dialog"] input[type="date"]` nth(1) | "To" label |
| Submit button | `[role="dialog"] button[type="submit"]` | "Add trip" text |
| Trip card | `article.rounded-xl.border` | One per trip |
| Trip city h2 | `article h2` | City name |
| Trip dates | `article p.readout` | Contains CalendarRange icon + formatted dates |
| Lodging input | `input[aria-label*="Lodging"]` | Exact pattern: "Lodging for your {cityName} trip" |
| Remove trip button | `button[aria-label*="Remove trip"]` | "Remove trip to {cityName}" |
| Lodging set button | `button[type="submit"]` scoped inside form inside article | Text: "Set" |

### City options confirmed
- Options count: 3 (blank + 2 cities including "miami")
- Cities load async via `fetchCities` — await after modal open (~1000ms)

### Key behaviors
- Trip card renders city h2 (e.g. "Miami") and date paragraph with formatted dates
- Dates formatted: `fmtDate("2026-07-01")` → "Jul 1" (no year if current year)
- Lodging input is inside an inline form in the trip card (not a modal)
- Remove button aria-label: `"Remove trip to {cityName}"`
- localStorage key: `scout-trips-v1`

### Trap: AddTripModal submit button disambiguation
The footer's Newsletter form also has a `button[type="submit"]`. Scope to `[role="dialog"]` when targeting the modal submit.

---

## Surface 4: Auth Chrome

### Component tree
- `SiteHeader` → `AuthButton` (`src/components/auth/AuthButton.tsx`)
  - Signed-out: renders button with `CircleUserRound` icon + "Sign in" text
  - Loading: aria-hidden ghost span
  - Signed-in: Link to /me with avatar initial
- `SignInModal` (`src/components/auth/SignInModal.tsx`)

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| Sign in button | `button:has-text("Sign in")` in header | Opens modal on click |
| SignInModal dialog | `[role="dialog"][aria-label="Sign in to Scout"]` | Fixed overlay |
| Email input | `[role="dialog"] input[type="email"]` | aria-label="Email address" |
| Send sign-in link button | `[role="dialog"] button[type="submit"]` | Text: "Send sign-in link" |
| Close button | `button[aria-label="Close sign in"]` | Top-right X button |
| Backdrop close | Click on outer dialog div | `onClick={onClose}` on root div |

### Email validation (from source + live verification)
- Empty string → submit disabled ✓
- `"notanemail"` → submit disabled ✓ (regex: `/^\S+@\S+\.\S+$/`)
- `"test@example.com"` → submit enabled ✓
- `"x@y"` → submit disabled (no TLD dot-separator)

### Important: Do NOT send the OTP
The test must stop at the enabled state. Never call `.click()` on the enabled submit button — it fires `signInWithOtp` to real Supabase and would attempt email delivery.

---

## Surface 5: /me Signed-Out

### Component tree
- `MePage` (`src/app/me/page.tsx`) — async RSC; passes `serverUser=null` when unauthenticated
- `ProfilePortal` (`src/components/profile/ProfilePortal.tsx`) — renders sign-in pitch when `user === null`

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| Page h1 | `h1` with text "Your Scout" | |
| CircleUserRound icon | `svg.lucide-circle-user-round` | Above h1 (mx-auto) |
| Sign in with email | `button:has-text("Sign in with email")` | Opens SignInModal |
| No skeleton-forever | Absence of `.skeleton` elements | Should resolve within 5s |

### Key behaviors
- Page is an async RSC + client ProfilePortal
- `serverUser` is set by reading Supabase auth on server (`getServerClient()`)
- Signed-out users see the pitch; no gym data fetch needed (no crash risk)
- The `user` value: first checks `clientUser` from `useUserStore`, then falls back to `serverUser`

---

## Surface 6: Static Pages

### Verified routes and selectors

| Route | HTTP Status | h1 Text | Notes |
|-------|-------------|---------|-------|
| /blog | 200 | "Guides from the gym map." | `ul li a` count: 10 (POSTS.length) |
| /blog/why-gym-fit-matters | 200 | "Why finding a gym that fits you matters more than finding a "good" gym" | Truncated in DOM |
| /about | 200 | "Every fact carries its source." | |
| /privacy | 200 | "Privacy, plainly." | |
| /terms | 200 | "Terms, briefly." | |
| /robots.txt | 200 | N/A | Contains "Sitemap:" and "Allow:" |
| /llms.txt | 200 | N/A | Public file served by Next.js |
| /sitemap.xml | 200 | N/A | Contains "urlset" |

### Blog post count
`POSTS` array in `src/lib/blog.ts` — **verified**: 10 posts (not 3 as per test scope brief). The brief says "3 post cards" but this is the minimum count to assert. Use `expect(count).toBeGreaterThanOrEqual(3)` or exact count from DOM.

### /robots.txt content
```
User-agent: *
Allow: /
Sitemap: https://scout-gym.netlify.app/sitemap.xml
```
Static file at `public/robots.txt`. Served at path `/robots.txt`.

### /sitemap.xml
Generated by `src/app/sitemap.ts` (Next.js MetadataRoute). Returns XML with `<urlset>` tag.

---

## Surface 7: Footer NewsletterForm

### Component tree
- `SiteFooter` (`src/components/SiteFooter.tsx`) renders `NewsletterForm`
- `NewsletterForm` (`src/components/NewsletterForm.tsx`) — form in footer

### Verified selectors (live DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| "New gyms" checkbox | `footer input[type="checkbox"]` nth(0) | Default checked=true |
| "Changes at gyms" checkbox | `footer input[type="checkbox"]` nth(1) | Default checked=true |
| Email input | `input[aria-label="Email for gym alerts"]` | |
| Alerts submit button | `button[aria-label="Subscribe"]` | disabled when: both unchecked OR invalid email |

### Disable logic (from source)
```javascript
disabled={state === "busy" || (!newGyms && !gymChanges) || !/^\S+@\S+\.\S+$/.test(email)}
```
- Both unchecked → disabled (regardless of email)
- Valid email + at least one interest → enabled
- Invalid/empty email → disabled

### Key behaviors
- Both checkboxes default-checked (`useState(true)`)
- Button starts disabled (valid email required even with both checked)
- Unchecking BOTH → disabled even with valid email
- Re-checking one → re-enabled if email is valid

### Do NOT submit
Never click the enabled submit button — it does `INSERT` into `email_subscribers` table.

---

## Surface 8: 404

### Verified behavior

| Check | Result |
|-------|--------|
| HTTP status | 404 (confirmed via `page.goto().status()`) |
| h1 text | "No waypoint here." |
| Readout above h1 | `p.readout.mt-6.text-blaze` → "404 · Off the map" (but see note) |
| Back to Explore link | `a:has-text("Back to Explore")` → href="/" |
| Header | SiteHeader renders (sticky nav intact) |

**Note on the readout element:** Source shows `<p className="readout mt-6 text-blaze">404 · Off the map</p>`. The selector `p.readout.mt-6.text-blaze` returns count: 1 on live DOM.

### Route
`/gym/nonexistent-slug-xyz` → `fetchGymBySlug` returns null → `notFound()` called → Next.js renders `src/app/not-found.tsx`.

---

## Open Questions

None. All selectors verified against live DOM. No ambiguous behaviors.

---

## Key Constraints for Test Implementation

1. **No `.textContent()` on possibly-absent elements** — use `.isVisible()` or `.count()` first (documented trap from gym-detail healing log).
2. **No multi-Page fixtures** — navigate within test body using a single fixture page object (documented trap from gym-detail healing log).
3. **No `waitForTimeout`** — use `expect(locator).toBeVisible()` / `waitFor({ state })`.
4. **No `force: true`** — all elements are genuinely interactive.
5. **Do NOT click enabled submit on SignInModal or Newsletter** — stop at assertion of enabled state.
6. **ShortlistButton is inside a Link** — click handler uses `e.preventDefault()` + `e.stopPropagation()`, safe to click directly.
7. **Store rehydration** — Zustand `skipHydration: true`: localStorage set before page load will be rehydrated correctly by HydrationGate on mount.
8. **Compare page**: requires 2+ gyms saved. Preferred approach: save via UI on home page, then navigate. Row label is "Monthly from" (not "Monthly").
9. **Blog post count**: 10 posts exist. Assert `≥ 3` or exact `toBe(10)` depending on test intent.
10. **AddTripModal submit**: scope to `[role="dialog"]` to avoid clash with Newsletter "Alerts" button (also `button[type="submit"]`).
