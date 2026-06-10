# Test Plan: journeys-chrome

**Feature slug:** `journeys-chrome`
**Architect:** qa-architect (Phase 2)
**Date:** 2026-06-10
**Analysis source:** specs/features/journeys-chrome-analysis.md

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 14 | Must-pass: core journeys and chrome correctness |
| P1 | 10 | Should-pass: additional coverage and persistence |
| P2 | 4 | Nice-to-have: edge cases and UX details |
| **Total** | **28** | |

---

## POM Architecture

### New POMs (tests/pages/)

| File | Surface | Responsibility |
|------|---------|----------------|
| `ShortlistPage.ts` | Shortlist + Header | Save button, header count, drawer, GymRow remove |
| `ComparePage.ts` | /compare | Empty state, table rows, gym columns |
| `TripsPage.ts` | /trips | Add trip modal, trip card, lodging, remove |
| `AuthPage.ts` | Auth chrome | SignInModal, email validation, close |
| `StaticPage.ts` | Static routes | Blog, about, privacy, terms, robots, llms, sitemap |

**Reuse existing:**
- `DiscoveryPage.ts` — for navigating home to save gyms before /compare

### Fixtures

| File | Fixtures exported |
|------|-------------------|
| `tests/fixtures/journeys.ts` | `journeysPage` (wraps a plain `Page`; provides `goto(path)` helpers) |

No multi-gym fixtures. All tests navigate within the test body.

---

## Test Specifications

### SPEC-01: Shortlist (tests/e2e/journeys/shortlist.spec.ts)

**P0 — SL-01: Save button toggle**
- Navigate to `/`
- Locate `button[aria-label="Save to shortlist"]` first match
- Assert aria-pressed="false" (or absent) before click
- Click
- Assert aria-label changes to "Remove from shortlist"
- Assert aria-pressed="true"
- Click again (unsave)
- Assert aria-label reverts to "Save to shortlist"

**P0 — SL-02: Header count updates**
- Navigate to `/`
- Assert header button `aria-label="Open shortlist (0 saved)"`
- Save first gym (click save button)
- Assert header label becomes `"Open shortlist (1 saved)"`
- Save second gym
- Assert header label becomes `"Open shortlist (2 saved)"`

**P0 — SL-03: Drawer opens and lists saved gym**
- Navigate to `/`
- Save one gym (record its name via nearby `h3.display` text before clicking)
- Click header shortlist button
- Assert `[role="dialog"][aria-label="Shortlist"]` is visible
- Wait for GymRow to appear: `a[href^="/gym/"]` inside drawer
- Assert gym name is present in drawer

**P0 — SL-04: Remove from drawer**
- Navigate to `/`, save one gym, open drawer
- Wait for `button[aria-label^="Remove "]` inside drawer to be visible
- Click it
- Assert drawer count badge shows 0 (or "Nothing saved yet" message appears)
- Assert header label returns to `"Open shortlist (0 saved)"`

**P1 — SL-05: Persists across reload**
- Navigate to `/`, save one gym, record savedIds count from header label
- Reload page (`page.reload()`)
- Wait for hydration: assert `button[aria-label*="Open shortlist"]` not "0 saved"
- Assert header label still shows "(1 saved)"

---

### SPEC-02: Compare (tests/e2e/journeys/compare.spec.ts)

**P0 — CMP-01: Empty state when nothing saved**
- Navigate to `/compare` (fresh context, no saved gyms)
- Assert h1 "Compare" is visible
- Assert `text="Not enough to compare"` is visible
- Assert `button:has-text("Find gyms")` is visible

**P0 — CMP-02: Table renders with 2 gyms**
- Navigate to `/`, save first gym, save second gym (using UI clicks)
- Navigate to `/compare`
- Wait for `table` to be visible (Supabase fetch required, up to 10s)
- Assert at least 2 gym name links in `thead a[href^="/gym/"]`

**P0 — CMP-03: Monthly from row present**
- (Setup: 2 gyms saved, table visible as in CMP-02)
- Assert `th:has-text("Monthly from")` is visible

**P0 — CMP-04: Drop-in row present**
- Assert `th:has-text("Drop-in")` is visible

**P1 — CMP-05: Parking row present in basic section**
- Assert first `th:has-text("Parking")` visible (basic rows section, before Amenities header)

**P1 — CMP-06: Day pass row present**
- Assert `th:has-text("Day pass")` is visible

---

### SPEC-03: Trips (tests/e2e/journeys/trips.spec.ts)

**P0 — TR-01: Add-trip form opens**
- Navigate to `/trips`
- Assert h1 "Trips" visible
- Click `getByRole('button', { name: 'Add trip' })`
- Assert `[role="dialog"][aria-label="Add trip"]` visible
- Assert `[role="dialog"] select` visible
- Assert `[role="dialog"] input[type="date"]` count = 2

**P0 — TR-02: Trip card appears with city name and dates**
- Navigate to `/trips`
- Click "Add trip"
- Wait for city options (options > 1)
- Select first non-blank city option
- Fill start date: `2026-09-01`
- Fill end date: `2026-09-07`
- Click `[role="dialog"] button[type="submit"]`
- Assert modal closes (not visible)
- Assert `article.rounded-xl` count ≥ 1
- Assert `article h2` text contains selected city name
- Assert `article p.readout` text contains "Sep 1" (formatted start date)

**P0 — TR-03: Lodging input present on trip card**
- (Setup: one trip card exists as in TR-02)
- Assert `input[aria-label*="Lodging"]` is visible
- Assert input is editable
- Do NOT submit lodging (no geocode assertion)

**P1 — TR-04: Remove trip**
- (Setup: one trip card exists as in TR-02)
- Assert `button[aria-label*="Remove trip"]` is visible
- Assert count of `article.rounded-xl` = 1
- Click remove button
- Assert count of `article.rounded-xl` = 0 (or empty state appears)

**P1 — TR-05: Persists across reload**
- (Setup: one trip card exists as in TR-02)
- Reload page
- Assert `article.rounded-xl` still count ≥ 1
- Assert city h2 still visible

---

### SPEC-04: Auth Chrome (tests/e2e/journeys/auth.spec.ts)

**P0 — AUTH-01: Header "Sign in" opens SignInModal**
- Navigate to `/`
- Assert `button:has-text("Sign in")` is visible in header
- Click it
- Assert `[role="dialog"][aria-label="Sign in to Scout"]` is visible
- Assert `[role="dialog"] input[type="email"]` is visible

**P0 — AUTH-02: Empty email → send disabled**
- (SignInModal open)
- Assert email input value is empty
- Assert `[role="dialog"] button[type="submit"]` is disabled

**P0 — AUTH-03: Invalid email → send disabled**
- Fill `[role="dialog"] input[type="email"]` with `"notvalid"`
- Assert submit still disabled

**P0 — AUTH-04: Valid email → send enabled**
- Fill email with `"test@example.com"`
- Assert submit is NOT disabled (enabled)
- **Stop here — do NOT click**

**P1 — AUTH-05: Modal closes via close button**
- (SignInModal open)
- Click `button[aria-label="Close sign in"]`
- Assert dialog not visible

**P1 — AUTH-06: Modal closes via Escape key**
- (SignInModal open)
- Press `Escape`
- Assert dialog not visible

---

### SPEC-05: /me Signed-Out (tests/e2e/journeys/me-signed-out.spec.ts)

**P0 — ME-01: Renders sign-in pitch**
- Navigate to `/me`
- Wait for page load (RSC + client hydration, up to 10s)
- Assert h1 "Your Scout" visible
- Assert `button:has-text("Sign in with email")` visible

**P1 — ME-02: No crash, no skeleton-forever**
- Navigate to `/me`
- Wait 5 seconds
- Assert no `.skeleton` elements visible
- Assert no unhandled error boundary text (no "Something went wrong")

**P2 — ME-03: CircleUserRound icon area present**
- Assert `svg` element above h1 is visible (icon area rendered)

---

### SPEC-06: Static Pages (tests/e2e/journeys/static.spec.ts)

**P0 — STAT-01: /blog lists at least 3 post cards**
- Navigate to `/blog`
- Assert h1 contains "Guides"
- Assert `ul li a` count ≥ 3

**P0 — STAT-02: /blog/[slug] renders article h1**
- Navigate to `/blog/why-gym-fit-matters`
- Assert h1 is visible
- Assert h1 text is non-empty (length > 5)

**P0 — STAT-03: /about renders**
- Navigate to `/about`
- Assert h1 contains "Every fact"

**P0 — STAT-04: /privacy renders h1**
- Navigate to `/privacy`
- Assert h1 visible and non-empty

**P0 — STAT-05: /terms renders h1**
- Navigate to `/terms`
- Assert h1 visible and non-empty

**P1 — STAT-06: /robots.txt 200 with Sitemap:**
- `page.goto('/robots.txt')` → assert response status 200
- Assert page body contains "Sitemap:"
- Assert page body contains "Allow:"

**P1 — STAT-07: /llms.txt 200**
- `page.goto('/llms.txt')` → assert response status 200
- Assert response body non-empty

**P1 — STAT-08: /sitemap.xml 200 with `<urlset`**
- `page.goto('/sitemap.xml')` → assert response status 200
- Assert page content contains "urlset"

---

### SPEC-07: Newsletter Form (tests/e2e/journeys/newsletter.spec.ts)

**P0 — NL-01: Checkboxes default-checked**
- Navigate to `/` (footer visible after scroll)
- Assert `footer input[type="checkbox"]` nth(0) is checked
- Assert `footer input[type="checkbox"]` nth(1) is checked

**P0 — NL-02: Unchecking both disables submit**
- Uncheck nth(0)
- Uncheck nth(1)
- Assert `button[aria-label="Subscribe"]` is disabled

**P0 — NL-03: Valid email + one interest enables submit**
- Re-check nth(0) (or keep one checked)
- Fill `input[aria-label="Email for gym alerts"]` with `"test@example.com"`
- Assert `button[aria-label="Subscribe"]` is NOT disabled (enabled)
- **Stop here — do NOT click**

**P2 — NL-04: Empty email keeps submit disabled even with both checked**
- Navigate to `/`
- Scroll to footer
- Assert checkboxes both checked
- Assert email input empty
- Assert submit disabled (both interests checked but no email)

---

### SPEC-08: 404 (tests/e2e/journeys/not-found.spec.ts)

**P0 — NF-01: /gym/nonexistent-slug-xyz returns not-found UI**
- `const resp = await page.goto('/gym/nonexistent-slug-xyz')`
- Assert `resp.status()` === 404
- Assert h1 "No waypoint here." visible

**P1 — NF-02: 404 page has site chrome intact**
- Assert header is visible (SiteHeader: `header` element or `a[aria-label="Scout home"]`)
- Assert "Back to Explore" link visible with href="/"

**P2 — NF-03: 404 blaze readout present**
- Assert `p.readout.mt-6.text-blaze` text contains "404"

---

## File Layout

```
tests/
  pages/
    ShortlistPage.ts      (new)
    ComparePage.ts        (new)
    TripsPage.ts          (new)
    AuthPage.ts           (new)
    StaticPage.ts         (new)
  fixtures/
    journeys.ts           (new)
  e2e/
    journeys/
      shortlist.spec.ts   (new)
      compare.spec.ts     (new)
      trips.spec.ts       (new)
      auth.spec.ts        (new)
      me-signed-out.spec.ts (new)
      static.spec.ts      (new)
      newsletter.spec.ts  (new)
      not-found.spec.ts   (new)
```

---

## Implementation Notes

### Fixture design
The `journeys.ts` fixture exports a single `journeysPage` fixture wrapping the Playwright `page`. It does not navigate — each test calls its own `goto`. This avoids the multi-Page fixture trap.

```typescript
// tests/fixtures/journeys.ts
import { test as base } from "@playwright/test";
import { ShortlistPage } from "../pages/ShortlistPage";

type Fixtures = { shortlistPage: ShortlistPage };
export const test = base.extend<Fixtures>({
  shortlistPage: async ({ page }, use) => {
    await use(new ShortlistPage(page));
  },
});
export { expect } from "@playwright/test";
```

Actually — given the diversity of surfaces, the simplest approach is to use raw `page` fixture from `@playwright/test` and instantiate POMs inside tests. This avoids fixture explosion for 8 different surfaces.

### Shortlist test strategy for /compare
Save gyms via UI in the test body (navigate to /, click two save buttons) rather than injecting localStorage. This tests the real flow and avoids needing hardcoded UUIDs.

### Wait strategy for async data
- Shortlist drawer GymRows: `await expect(page.locator('[role="dialog"][aria-label="Shortlist"] a[href^="/gym/"]')).toBeVisible({ timeout: 10_000 })`
- Compare table: `await expect(page.locator('table')).toBeVisible({ timeout: 15_000 })`
- Trip card: `await expect(page.locator('article.rounded-xl')).toBeVisible({ timeout: 5_000 })`
- /me RSC: `await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })`

### No `waitForTimeout`
Use Playwright's built-in retry-based assertions only.

### Test count total: 28
- P0: 14 tests (SL-01..04, CMP-01..04, TR-01..03, AUTH-01..04, ME-01, STAT-01..05, NL-01..03, NF-01)
- P1: 10 tests (SL-05, CMP-05..06, TR-04..05, AUTH-05..06, ME-02, STAT-06..08, NF-02)
- P2: 4 tests (ME-03, NL-04, NF-03, plus one floating)
