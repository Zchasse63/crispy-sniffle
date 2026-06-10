# Feature Design Document: Discovery Core

**Feature slug:** `discovery-core`
**Analyst:** qa-analyst
**Date:** 2026-06-10
**Target URL:** http://localhost:3100

---

## 1. Overview

Discovery Core is the full-page gym-finder experience at `/` (root). It consists of:
- A dark hero strip with NL search bar + example chips
- A segment icon row (gym-type filter bar)
- A sticky count/query/view-mode control strip
- A desktop filter rail (aside)
- A results area (list or map view)

All state lives in `filterStore` (Zustand). Scoring runs on the client in `scorer.ts`. No page navigation occurs during filtering — everything is SPA reactive.

---

## 2. Verified Selectors (from live DOM + source code)

### 2.1 NL Search Bar

| Element | Selector | Notes |
|---|---|---|
| Search input | `input[aria-label="Describe your ideal gym"]` | type=text, disabled during parse |
| Submit button | `button[type="submit"]` | text "Scout it" (or spinner "Plotting" during parse) |
| Submit button (text match) | `role=button, name="Scout it"` | accessible name |
| Search form | `form[role="search"]` | wraps input + buttons |
| Example chips container | `.flex.flex-wrap` inside SearchBar's div below the form | renders only when `rawQuery === ""` |
| Individual example chips | `button` children of the chips row, text: "vibey yoga studio", "lift heavy with a sauna, under $25", "trendy gym that's instagram friendly" | |

### 2.2 Parse Badge (sticky count bar)

| Element | Selector | Notes |
|---|---|---|
| AI-parsed badge | text "AI-parsed" within `span` containing Sparkles icon | class `bg-pool-tint` |
| Quick-parsed badge | text "Quick-parsed" within `span` | class `border-contour` |
| Query chip | `span.font-mono` with `"..."` quoted text + X button | only when `filtersActive && filters.rawQuery` |
| X button on query chip | `button[aria-label="Clear search"]` inside query chip | |
| Gym count | `span.font-mono.text-xs` with text `N gyms` or `1 gym` | first element in sticky bar |

### 2.3 Sticky Count Bar Container

The sticky bar is a `div.sticky.top-16.z-30` containing the count span, query chip, parse badge, and view-mode buttons.

### 2.4 Segment Icon Row

| Element | Selector | Notes |
|---|---|---|
| Nav container | `nav[aria-label="Gym types"]` | |
| All segment buttons | `nav[aria-label="Gym types"] button` | 9 total |
| Individual buttons (by title) | `button[title="Strength & Powerlifting"]`, etc. | title set by source |
| aria-pressed hard filter | `aria-pressed="true"` on button when segment hard-selected | |
| Soft (dashed) button style | `border-dashed` CSS class present; label text ends with ` ~` | |

Segment order: strength, crossfit, big_box, boutique, luxury, climbing, yoga_pilates, mma, recovery.
Button titles (exact): "Strength & Powerlifting", "CrossFit", "Big Box", "Boutique Studio", "Luxury Club", "Climbing", "Yoga & Pilates", "MMA & Boxing", "Recovery".

### 2.5 Filter Rail (desktop, inside `<aside>`)

| Element | Selector | Notes |
|---|---|---|
| Rail container | `aside div.rounded-xl.border` | desktop only (hidden on mobile via `lg:hidden`) |
| Amenity checkboxes | `label` elements inside "Amenities" section | visual checkbox, hidden `input[type=checkbox]` |
| Amenity checkbox input | `input[type="checkbox"]` inside each label | sr-only, but `.checked` property readable |
| Day pass slider | `input[type="range"][aria-label="Maximum day pass price"]` | min=5, max=60, step=5 |
| Day pass display | `span` with text "Any price" or "≤ $N" | |
| Clear all button | `button` text "Clear all" inside rail header | only when `active === true` |
| Neighborhood select | `select[aria-label="Neighborhood"]` | |

### 2.6 Weak-Match Banner

| Element | Selector | Notes |
|---|---|---|
| Banner container | `div.rounded-xl.border.border-pool/30` wrapping Compass icon paragraph | only visible when `showWeakBanner` is true |
| Banner text | contains "Closest fits" or "Only N spots match" | |
| Relax chips | `button` inside `div.mt-2.5.flex.flex-wrap.gap-2.pl-6.5` | text like `Drop "Yoga & Pilates"`, "Any price", "Any hours", "Search all of Tampa" |

### 2.7 GymCard (list view)

| Element | Selector | Notes |
|---|---|---|
| Card container | `a[href^="/gym/"]` | is a Link wrapping the card |
| Gym name | `h3.display` inside card | |
| Neighborhood | `span` with MapPin icon sibling | |
| Open status chip | `span` with Clock icon sibling | text matches /Open ·|Closes|Opens/ |
| FREE PARKING chip | `span` text "free parking" (lowercased) | logic: `amenity_key === "parking"` + free/customers access |
| Match badge | `.matchbadge` or component rendered when `matchScore !== null` | |
| "Why it fits" section | `span` containing `<b>Why it fits:</b>` | only when `matchReasons.length > 0` |

### 2.8 MatchBadge Component

| Element | Selector | Notes |
|---|---|---|
| Badge container | Component `MatchBadge` | score shown as text like "100" |

### 2.9 Map View

| Element | Selector | Notes |
|---|---|---|
| Map toggle button | `button[aria-pressed]` text "Map" inside role="group" aria-label="View mode" | |
| List toggle button | `button[aria-pressed]` text "List" | |
| Mapbox canvas | `.mapboxgl-canvas` | rendered by Mapbox GL JS |
| Scout pins | `.scout-pin` | custom DOM elements, one per gym with coordinates |
| Pin label | `.scout-pin-label` | text = matchScore, day_pass_price, or "•" |
| Popup container | `.mapboxgl-popup-content` | appears on pin click |
| "View gym →" link | `a` text "View gym →" inside popup | href="/gym/{slug}" |
| Parking line in popup | div starting with "P · " | present when gym has `is_primary` parking entry |

### 2.10 Near Me Filter (inside FilterRail > "Near me" section)

| Element | Selector | Notes |
|---|---|---|
| Drive button | `button[aria-pressed]` text "Drive" | |
| Walk button | `button[aria-pressed]` text "Walk" | |
| Minute chips | `button` with text "10 min", "20 min", "30 min" | `disabled` when geolocation pending |
| Disabled state note | `p` element with note text | when geolocation unavailable |

---

## 3. Workflow Mappings

### Workflow A: NL Search + Example Chips
1. Page loads → `rawQuery === ""` → example chips visible below search form
2. User clicks example chip → `runSearch(chip text)` → `isParsing = true` → button shows "Plotting" → API call to `parseQuery`
3. On resolve → `setFilters(filterSet, via)` → `parsedVia` set to `"ai"` or `"fallback"`
4. Sticky bar updates: gym count, query chip `"text"`, parse badge (AI-parsed or Quick-parsed)
5. Example chips disappear (rawQuery is now non-empty)
6. Results re-render

### Workflow B: Manual Search Submit
1. User types in input → clicks "Scout it" or presses Enter
2. Same flow as above

### Workflow C: Acceptance Searches (live data ordering)
- "yoga studio with a cold plunge" → Kodawari Studios expected first, `matchScore === 100`
- "women's only gym" → Fox Fitness and Peach Lab in top 2 results
- "lift heavy with a day pass under $25" → 813 Barbell / Powerhouse in top 3; no gym priced > $25 shown

### Workflow D: Segment Icon Row
1. Click un-pressed segment button → `aria-pressed` becomes `"true"`, count drops, button gets solid style
2. Click again → `aria-pressed` becomes `"false"`, count restores
3. AI search with segment preference → relevant button shows dashed border + "~" suffix in label

### Workflow E: Filter Rail — Amenities
1. Check amenity checkbox → results update, count drops
2. Multiple amenities checked → over-constrained → weak-match banner may appear
3. Relax chip clicked → matching filter removed → count recovers

### Workflow F: Filter Rail — Day Pass Slider
1. Slider at 60 (max) → "Any price" displayed
2. Drag slider left → "≤ $N" displayed, results filtered to gyms with day_pass_price <= N

### Workflow G: Weak-Match Banner + Relax Chips
1. Active filters + topScore < 70 (or ≤ 3 results with relaxChips) → banner visible
2. Click relax chip → specific filter removed → banner re-evaluates

### Workflow H: Map View
1. Click "Map" button → `view = "map"` → `<MapView>` renders
2. `.mapboxgl-canvas` appears after map init
3. `.scout-pin` elements = one per gym in `scored` array (gyms with lat/lng)
4. Click pin → popup opens → `.mapboxgl-popup-content` with gym name + "View gym →"
5. Parking line "P · ..." appears when gym has primary parking entry
6. Click "List" button → map unmounts, list re-renders

### Workflow I: Clear/Reset
1. Click "Clear all" in filter rail → `resetFilters()` → all filters removed
2. Click X on query chip → `resetFilters()` → same effect
3. After reset: count returns to full (35 unfiltered expected), example chips reappear

---

## 4. Data Expectations (Tampa Live Data)

- Total unfiltered gyms: **35** (based on map pin count spec and count bar)
- Acceptance search results assume live Supabase data in prod/dev database
- Kodawari Studios has `matchScore === 100` for yoga + cold plunge query
- Fox Fitness and Peach Lab are women's-specific or women's-area gyms (top 2 for women's only)
- 813 Barbell / Powerhouse are strength gyms with day pass ≤ $25

---

## 5. Non-Goals (Out of Scope)

- Voice input (`VoiceButton`) — Web Speech API unavailable headless
- Geolocation `Near me` activation (assert UI structure only: Drive/Walk + 10/20/30 chips + disabled-state messaging)
- Auth flows (shortlist button, profile)
- Mobile filter drawer

---

## 6. Open Questions

None — all selectors confirmed via source code + live HTML response. Acceptance search data expectations are specified by the user and treated as ground truth.

---

## 7. Risk Notes

- **Map pin count:** `.scout-pin` count depends on gyms having non-null lat/lng. If some gyms have null coords, the pin count may be < 35. Test should use `>=` comparison or verify actual count from a no-filter state.
- **Parse badge:** `parsedVia` comes from the AI edge function; headless tests must be run with network access to Supabase. If the AI endpoint is unreachable, `"fallback"` will be set.
- **Open status chip:** rendered only after React hydration (`useEffect`). The Clock chip text is time-dependent; use regex match not exact string.
- **Weak-match banner:** requires a combination of `filtersActive`, low scores, and non-null `topScore`. The exact amenity combination to trigger it may vary with live data; checking 5+ amenities is a safe trigger.
- **Map canvas load time:** Mapbox GL JS requires a valid token and network access to render the canvas. Use `waitForSelector` with a generous timeout (10s+).
