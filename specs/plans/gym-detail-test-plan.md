# Test Plan: Gym Detail Page

**Feature slug:** gym-detail  
**Architect:** qa-architect (Phase 2)  
**Date:** 2026-06-10  
**Source:** specs/features/gym-detail-analysis.md  
**Test directory:** tests/e2e/gym-detail/  
**POM:** tests/pages/GymDetailPage.ts  
**Fixture:** tests/fixtures/gymDetail.ts  

---

## Summary

| Priority | Count | Focus |
|---|---|---|
| P0 (blocking) | 12 | Hero, TrainHere modal, JSON-LD, gallery presence, hours open status, getting-in card |
| P1 (high) | 14 | AttributeSections, parking/transit, community layout, outbound links, similar spots |
| P2 (nice) | 4 | Provenance badge details, break-even math precision, 24h text, segment heading |
| **Total** | **30** | |

---

## Spec File Organization

```
tests/e2e/gym-detail/
  hero.spec.ts            — HERO-01..HERO-08  (P0/P1)
  train-here.spec.ts      — TH-01             (P0)
  gallery.spec.ts         — GAL-01..GAL-02    (P0/P1)
  attribute-sections.spec.ts — ATTR-01..ATTR-08 (P0/P1/P2)
  hours.spec.ts           — HRS-01..HRS-02    (P0)
  getting-in.spec.ts      — GI-01..GI-03      (P0/P1/P2)
  parking-transit.spec.ts — PARK-01..PARK-05  (P1/P2)
  community.spec.ts       — COM-01..COM-06    (P1)
  seo.spec.ts             — SEO-01            (P0)
  similar-spots.spec.ts   — SIM-01            (P1)
```

---

## Test Cases

### HERO (hero.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| HERO-01 | P0 | all | `h1` contains gym name on each of the three gyms |
| HERO-02 | P0 | all | `p.readout.text-pool` in hero contains segment label (e.g. "Strength & Powerlifting", "Yoga & Pilates", "Big Box") |
| HERO-03 | P1 | all | Neighborhood text rendered in hero meta paragraph |
| HERO-04 | P0 | powerhouse + kodawari | Day-pass chip `span:has-text("Day pass $")` present and contains `$` price; absent on amped |
| HERO-05 | P0 | all | Directions link exists with `href` matching `/maps.google|google.com\/maps/` and `target="_blank"` |
| HERO-06 | P1 | powerhouse + kodawari | Call link `a[href^="tel:"]` present; absent on amped (no phone) |
| HERO-07 | P1 | all | Website link `a:has-text("Website")` has `target="_blank"` and href starting with `http` |
| HERO-08 | P0 | all | Back link `a:has-text("Back to Explore")` exists with `href="/"` |

### TRAIN HERE (train-here.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| TH-01 | P0 | powerhouse | Clicking "I trained here" signed-out opens `[role="dialog"][aria-label="Sign in to Scout"]`; `input[type="email"]` is visible; no crash |

### GALLERY (gallery.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| GAL-01 | P0 | powerhouse | Gallery scroll container `div.flex.gap-2.overflow-x-auto` exists; contains >= 1 `img` |
| GAL-02 | P1 | amped | Gallery scroll container absent (count = 0); page renders without error (h1 still present) |

### ATTRIBUTE SECTIONS (attribute-sections.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| ATTR-01 | P0 | powerhouse | `h2:has-text("Equipment")` exists; `span:has-text("Pro preview")` visible |
| ATTR-02 | P1 | powerhouse | At least one `li.group\/fact` inside equipment section; equipment key labels present (e.g. "Barbells", "Squat Racks") |
| ATTR-03 | P1 | all | Provenance badge span (`span.readout:has-text("Web Data")`) present in at least one fact row |
| ATTR-04 | P1 | powerhouse | "Estimated" provenance badge visible at least once on the page |
| ATTR-05 | P0 | all | NO confirm/correct buttons visible signed-out inside fact rows (button count inside `li.group\/fact` = 0) |
| ATTR-06 | P2 | powerhouse | Count chips (confidence %) visible: `span.opacity-60` inside a provenance badge span (at least 1) |
| ATTR-07 | P1 | amped | "Women's-Only Area" label visible in attribute section |
| ATTR-08 | P0 | kodawari | Equipment section absent (h2:has-text("Equipment") count = 0) |

### HOURS (hours.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| HRS-01 | P0 | powerhouse + kodawari | Open/Closed status chip present; text matches `/Open|Closed/`; entire Hours section exists |
| HRS-02 | P0 | amped | `text="Open 24 hours, every day"` visible; Open now chip present |

### GETTING IN (getting-in.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| GI-01 | P0 | powerhouse | Getting in section present; `span:has-text("Walk in")` visible |
| GI-02 | P0 | kodawari | `span:has-text("Book first")` visible |
| GI-03 | P2 | powerhouse | Break-even line `p:has-text("visit each month")` visible (has both monthly_from and day_pass_price) |

### PARKING & TRANSIT (parking-transit.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| PARK-01 | P1 | powerhouse | Parking section `h2:has-text("Parking")` exists; primary recommendation `p.font-semibold` inside section has text |
| PARK-02 | P1 | powerhouse | Alternatives list `ul.mt-3.divide-y` exists with >= 1 `li` |
| PARK-03 | P1 | powerhouse | Transit footer present (contains "Bus stop" text) |
| PARK-04 | P1 | powerhouse | `text="Parking & transit data © OpenStreetMap contributors"` visible in parking section |
| PARK-05 | P2 | amped | Parking section absent (count = 0) — ParkingCard returns null |

### COMMUNITY (community.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| COM-01 | P1 | all | CommunitySection inside left grid column (first child of `div.grid.grid-cols-1.gap-6`) not the aside |
| COM-02 | P1 | all | `button:has-text("Sign in to review")` visible signed-out; no review form textarea |
| COM-03 | P1 | powerhouse | Reddit discussion links have `target="_blank"` and `rel` containing `"noopener"` |
| COM-04 | P1 | powerhouse | At least 1 outbound link with `href*="reddit.com"` visible |
| COM-05 | P1 | all | `a:has-text("Verify your info")` exists with `href` matching `mailto:` and `Verify` |
| COM-06 | P1 | amped | No reddit links; community section still renders without error |

### SEO (seo.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| SEO-01 | P0 | all | `script[type="application/ld+json"]` exists; parses as valid JSON; `@type === "ExerciseGym"`; `name` equals gym name |

### SIMILAR SPOTS (similar-spots.spec.ts)

| ID | Priority | Gym | Assertion |
|---|---|---|---|
| SIM-01 | P1 | all | `a[href^="/gym/"]` count >= 1; similar section heading matches `/Similar.*spots/i` |

---

## POM Design (GymDetailPage.ts)

```
GymDetailPage(page, slug)
  .goto()            — navigates to /gym/{slug}, waits for h1
  .h1()              — Locator → h1
  .segmentChip()     — Locator → p.readout.text-pool in hero section
  .neighborhoodLine() — Locator → p.readout.mt-3 in hero
  .dayPassChip()     — Locator → span matching "Day pass $"
  .open24hChip()     — Locator → span:has-text("Open 24h")
  .directionsLink()  — Locator → a:has-text("Directions")
  .callLink()        — Locator → a[href^="tel:"]
  .websiteLink()     — Locator → a:has-text("Website")
  .backLink()        — Locator → a:has-text("Back to Explore")
  .trainHereButton() — Locator → button:has-text("I trained here")
  .signInModal()     — Locator → [role="dialog"][aria-label="Sign in to Scout"]
  .emailInput()      — Locator → input[type="email"]
  .galleryContainer() — Locator → div.flex.gap-2.overflow-x-auto
  .galleryImages()   — Locator → div.flex.gap-2.overflow-x-auto img
  .equipmentHeading() — Locator → h2.readout matching "Equipment"
  .proPreviewChip()  — Locator → span:has-text("Pro preview")
  .factRows()        — Locator → li.group\/fact
  .openStatusChip()  — Locator → span:has-text("Open now") or span:has-text("Closed now")
  .hours24hText()    — Locator → text="Open 24 hours, every day"
  .gettingInSection() — Locator → section:has(h2:has-text("Getting in"))
  .dropInPolicyChip(text) — Locator → span matching text inside getting-in section
  .breakEvenLine()   — Locator → p:has-text("visit each month")
  .parkingSection()  — Locator → section:has(h2:has-text("Parking"))
  .osmAttribution()  — Locator → text="Parking & transit data © OpenStreetMap contributors"
  .communitySection() — Locator → section:has(h2:has-text("From the community"))
  .reviewSignInButton() — Locator → button:has-text("Sign in to review")
  .discussionLinks() — Locator → a[href*="reddit.com"] (or broader: outbound links in community)
  .verifyOwnLink()   — Locator → a:has-text("Verify your info")
  .jsonLdScript()    — Locator → script[type="application/ld+json"]
  .similarSection()  — Locator → section:has(h2:has-text("Similar"))
  .similarGymLinks() — Locator → a[href^="/gym/"]
```

---

## Fixture Design (gymDetail.ts)

Three named fixtures, each navigating to a different gym slug:

```typescript
type GymDetailFixtures = {
  powerhousePage: GymDetailPage;
  kodawariPage: GymDetailPage;
  ampedPage: GymDetailPage;
};
```

Each fixture instantiates `GymDetailPage` and calls `.goto()`.

---

## Non-Goals (confirmed out of scope)

- Signed-in flows (no test account, no Supabase auth)
- Map mini-image pixel-level checks (img presence only, covered by gallery)
- Compare and Trips features
- Mobile breakpoint layout
- Review form submission (signed-in only)
- FactConfirm button behavior (signed-in only)
- Star rating widget interaction
