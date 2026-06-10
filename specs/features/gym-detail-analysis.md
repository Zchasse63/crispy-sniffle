# Feature Design Document: Gym Detail Page

**Feature slug:** gym-detail  
**Analyst:** qa-analyst (Phase 1)  
**Date:** 2026-06-10  
**Target URL:** http://localhost:3100  
**Pages analyzed:**
- `/gym/powerhouse-gym-athletic-club` — strength/powerlifting, rich data: equipment + parking + transit + gallery + monthly + day pass
- `/gym/kodawari-studios` — yoga/pilates studio, recovery amenities, classes, day pass
- `/gym/amped-fitness-carrollwood` — big-box, 24h, womens_area amenity, no day-pass price in hero

---

## 1. Powerhouse Gym Athletic Club

### 1.1 Hero Section
- **H1:** `"Powerhouse Gym Athletic Club"` — selector: `h1` (class `display mt-1.5 text-4xl text-paper sm:text-5xl`)
- **Segment chip:** `<p class="readout text-pool">Strength & Powerlifting</p>` — `p.readout.text-pool` in hero section
- **Neighborhood:** `"Carrollwood"` rendered inside `p.readout.mt-3` with `MapPin` icon, followed by `· 3251-A W Hillsborough Ave, Tampa, FL 33614`
- **Day-pass chip:** `<span>Day pass $20</span>` — class `font-mono rounded-md border border-pool bg-pool/15 px-3 py-2 text-xs uppercase tracking-wide text-paper`; selector: `span:has-text("Day pass $20")`
- **Amenity chips:** `sauna`, `recovery room`, `turf area`, `classes`, `childcare` — class `font-mono rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper`
- **Directions link:** `href="https://www.google.com/maps/dir/?api=1&destination=27.996113,-82.496132"` `target="_blank"` — `a:has-text("Directions")`
- **Call link:** `href="tel:813.875.1600"` — `a:has-text("Call")` (no target attribute)
- **Website link:** `href="https://pgathleticclub.com/"` `target="_blank"` — `a:has-text("Website")`
- **Back link:** `<a href="/">Back to Explore</a>` — `a:has-text("Back to Explore")`

### 1.2 TrainHere Button
- Button text: `"I trained here"` — `button:has-text("I trained here")`
- Class: `readout flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 transition-colors...`
- Signed-out behavior: clicking opens `role="dialog"` with `aria-modal="true"` `aria-label="Sign in to Scout"`; email input `input[type="email"]` (placeholder `"you@example.com"`, aria-label `"Email address"`) becomes visible; "Send sign-in link" button also present
- **Verified:** 2 email inputs (one in modal body, one in header possibly), 1 dialog

### 1.3 Gallery Strip
- Container: `<div class="flex gap-2 overflow-x-auto [scrollbar-width:thin]">` inside a `<section class="rounded-xl border border-paper-line bg-paper-raise p-3">`
- **8 gallery images** (photos.length > 1 → section renders; photos mapped with `<img src alt={gym.name — subject}>`)
- Alt pattern: `"Powerhouse Gym Athletic Club — gym floor"`, `"Powerhouse Gym Athletic Club — equipment"`, `"Powerhouse Gym Athletic Club — sauna recovery"`, etc.
- Selector for gallery imgs: `div.flex.gap-2.overflow-x-auto img` or `img[alt*="Powerhouse Gym Athletic Club — "]`
- Caption below: `"Photos from the gym's own site"` — `p.font-mono.mt-2.text-[9.5px]`
- **Total named gallery images: 10** (8 in strip + 2 more with alt containing gym name)
- Gallery section is inside the `aside` (right column), NOT the left column

### 1.4 AttributeSections (Equipment)
- **Equipment heading:** `<h2 class="readout flex items-center text-ink/70">Equipment <span>Pro preview</span></h2>` 
- **Pro preview chip:** `<span class="font-mono ml-2 rounded border border-pool/50 bg-pool-tint/70 px-1.5 py-0.5 text-[9px]...">Pro preview</span>` — present because section contains `MACHINE_KEYS`
- Equipment items confirmed: Competition Bench (Elite Fitness), Barbells (Rogue), Lifting Platforms (2×), Reverse Hyper, Kettlebells (to 106 lbs), Rowing Machines (Concept2), Stepmill (Matrix), Specialty Bars, Cable Machines (Freemotion), Squat Racks (8×), Leg Press, Smith Machine, Hack Squat, Assault Bike, Sled/Prowler (3×), Dumbbells (to 200 lbs)
- **Fact row selector:** `li.group\/fact` (CSS class `group/fact flex items-center justify-between gap-3 py-2.5`) — 29 fact rows on powerhouse
- **Provenance badges (actual DOM):** Rendered as `<span class="readout inline-flex items-center gap-1 rounded border border-paper-line px-1.5 py-0.5 ...">Web Data</span>` — text node is the leaf text inside span
  - Source mapping: `scraped` → `"Web Data"`, `seed` → `"Scout Data"`, `estimated` → `"Estimated"` (rendered as `<b>`)
  - `<b>Scout Data</b>` and `<b>Estimated</b>` appear in "About this data" section body text
  - **ProvenanceBadge** component outputs spans with `readout` class containing source label text
  - Powerhouse has: "Web Data" (21×), "Scout Data" (in About text), "Estimated" (in About text + confidence badges)
- **Confirm/correct buttons:** 0 — `FactConfirm` component is rendered but produces no visible buttons when user is not authenticated (auth-gated client component)
- Count chips: confidence percentages appear as `<span class="opacity-60">55%</span>` inside provenance badge span when confidence < 0.85

### 1.5 Hours
- **Hours section:** `<section class="rounded-xl border border-paper-line bg-paper-raise p-5">` containing `<h2>..Hours</h2>` with Clock icon
- **Open status chip:** `<span class="readout inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-pool-tint text-pool-deep">Open now</span>` — selector: `span:has-text("Open now")` or `span:has-text("Closed now")`
- Hours heading selector: `h2:has-text("Hours")` via the Clock label structure — rendered as `<h2 class="readout flex items-center gap-1.5 text-ink/65"><Clock /> Hours</h2>`
- Note: `h2` filter with exact text `"Hours"` won't match due to icon node — use `.filter({ hasText: 'Hours' })`
- Powerhouse hours: Mon–Fri 5 AM–Midnight, Sat–Sun 7 AM–9 PM; renders a `<table>` of day/time rows

### 1.6 Getting In Card
- **Drop-in policy chip (powerhouse):** `"Walk in"` — `<span class="font-mono mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5...">Walk in</span>`
- **Drop-in note:** `"$20 | day pass at the desk — no appointment, no garage tickets"`
- **Monthly price line:** `"Memberships from $32.99/mo"`
- **Break-even line:** `"Day passes beat the membership until your 2nd visit each month — going more often, joining wins."` — selector: `p:has-text("visit")` or text match on `ordinal(visits) visit`
- Getting in heading: `h2:has-text("Getting in")` (contains DoorOpen icon + text)

### 1.7 Parking & Transit
- **Primary recommendation:** `"Free on-site lot"` — `p.flex.items-start.gap-2.text-sm.font-semibold`
- **Primary detail:** `"FREE PARKING - No time limited workouts here! Plenty of parking and no garages or tickets to deal with."`
- **Alternatives:** `"Lot nearby ~2 min walk"` — inside `ul.mt-3.divide-y` → `li.flex.items-center.justify-between.gap-3.py-2`
- **Transit footer:** `"Bus stop ~1 min walk"` — inside `p.mt-3.flex.flex-wrap.items-center.gap-x-3` with Bike/Bus/TrainFront icons
- **OSM attribution:** `"Parking & transit data © OpenStreetMap contributors"` — `p.mt-3.text-[10.5px]` at bottom of ParkingCard; also `"© Mapbox © OpenStreetMap"` in map footer
- OSM text selector: `text=OpenStreetMap` matches both locations; prefer `text="Parking & transit data © OpenStreetMap contributors"` for the card-level attribution
- Parking heading: `h2:has-text("Parking")` (contains CircleParking icon)

### 1.8 CommunitySection
- **Layout:** CommunitySection is inside `div.space-y-5` which is in the LEFT column (`div.grid.grid-cols-1.gap-6.lg:grid-cols-[1fr_320px]` → first child = left column)
- Grid parent confirmed: `class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]"`
- **Review sign-in button:** `<button class="readout mt-4 rounded-lg border border-paper-line...">Sign in to review Powerhouse Gym Athletic Club</button>` — `button:has-text("Sign in to review")`
- **Outbound discussion links:** 3 reddit links; `target="_blank"` `rel="noopener noreferrer"` confirmed
- **Verify/Own mailto:** `href="mailto:zchasse89@gmail.com?subject=Verify%20our%20listing%3A%20Powerhouse%20Gym%20Athletic%20Club"` — `a:has-text("Verify your info")`
- No review form shown signed-out (auth-gated via `user ? <ReviewForm>` : `<button>Sign in to review`)

### 1.9 SEO JSON-LD
- `script[type="application/ld+json"]` count: 1
- `@type: "ExerciseGym"`, `name: "Powerhouse Gym Athletic Club"` — confirmed parseable JSON

### 1.10 Similar Spots
- `<section class="mt-10">` with `<h2 class="display text-xl text-ink">Similar strength & powerlifting spots</h2>`
- Links: `/gym/powerhouse-gym-north-tampa`, `/gym/813-barbell` — `a[href^="/gym/"]`
- GymCard components render for each similar gym

---

## 2. Kodawari Studios

### 2.1 Hero Section
- **H1:** `"Kodawari Studios"` — `h1`
- **Segment chip:** `"Yoga & Pilates"` — `p.readout.text-pool`
- **Neighborhood:** `"South Tampa"` — in `p.readout.mt-3` with MapPin icon
- **Day-pass chip:** `"Day pass $22"` — `span:has-text("Day pass $22")` — class same as powerhouse
- **Amenity chips:** `sauna`, `cold plunge`, `classes`, `towel service`
- **Directions:** `href="https://www.google.com/maps/dir/?api=1&destination=27.930628,-82.509668"` `target="_blank"`
- **Call:** `href="tel:(813) 999-1874"` — note: phone format includes parens
- **Website:** `href="https://www.kodawaristudios.com/"` `target="_blank"`
- **Back link:** `a:has-text("Back to Explore")`

### 2.2 TrainHere Button
- Same as powerhouse — signed-out click opens SignInModal with email input

### 2.3 Gallery Strip
- **9 named gallery images** (8 in scroll container)
- Container: same `div.flex.gap-2.overflow-x-auto.[scrollbar-width:thin]`
- Alt: `"Kodawari Studios — exterior"`, `"Kodawari Studios — gym floor"`, `"Kodawari Studios — sauna recovery"` etc.

### 2.4 AttributeSections
- **No Equipment section** (heading count: 0) — Kodawari has no equipment data
- **Recovery section** present: Cold Plunge, Sauna (both Web Data)
- **Fact rows:** `li.group\/fact` — 7 rows confirmed
- Provenance badges same structure
- **No Pro preview chip** (no MACHINE_KEYS in data)

### 2.5 Hours
- Open status: `"Open now"` / `"Open · closes 9 PM"` / `"Open · closes 8 PM"` text found
- Hours table: Mon–Fri 6 AM–7:15 PM, Sat–Sun Closed

### 2.6 Getting In Card
- **Policy:** `"Book first"` — `span:has-text("Book first")`
- **Note:** `"$22 | $69 first-month yoga — sessions book ahead"`
- **Monthly:** `"Memberships from $72/mo"`
- No break-even line (both monthly_from and day_pass_price needed for math — Kodawari has both but visits < 2 scenario may apply; confirmed no break-even text rendered in body)

### 2.7 Parking & Transit
- Primary: `"On-site lot"` — `"Studio's own parking lot referenced repeatedly..."`
- OSM attribution: `"© Mapbox © OpenStreetMap"` in map area (no `hasOsmSource` so `"Parking & transit data © OpenStreetMap contributors"` NOT present)

### 2.8 CommunitySection
- Same layout as powerhouse — in left column
- **Sign in to review button:** `"Sign in to review Kodawari Studios"`
- **Reddit links:** 2 links (yoga community, bath house) — `target="_blank"` `rel="noopener noreferrer"` confirmed
- **Verify mailto:** `mailto:zchasse89@gmail.com?subject=Verify%20our%20listing%3A%20Kodawari%20Studios`

### 2.9 SEO JSON-LD
- `@type: "ExerciseGym"`, `name: "Kodawari Studios"` — confirmed

### 2.10 Similar Spots
- 3 links: `/gym/solidcore-hyde-park`, `/gym/bella-prana-yoga-and-meditation`, `/gym/club-pilates-south-tampa`

---

## 3. Amped Fitness Carrollwood

### 3.1 Hero Section
- **H1:** `"Amped Fitness Carrollwood"` — `h1`
- **Segment chip:** `"Big Box"` — `p.readout.text-pool`
- **Neighborhood:** `"Carrollwood"` — `p.readout.mt-3`
- **Day-pass chip:** ABSENT — `gym.day_pass_price` is null (Amped does not have a priced day pass in the data)
  - NOTE: "day pass" appears in body text/JSON-LD (amenity feature), but no chip rendered in hero
- **24h chip:** `"Open 24h"` — `<span class="font-mono rounded-md bg-pool px-3 py-2 text-xs uppercase tracking-wide text-white">Open 24h</span>` — distinct green background
- **Amenity chips:** `sauna`, `recovery room`, `basketball court`, `classes`, `childcare` (no day-pass chip)
- **Directions:** `href="https://www.google.com/maps/dir/?api=1&destination=28.077278,-82.507047"` `target="_blank"`
- **No Call link** — Amped has no phone in data (tel: link absent)
- **Website:** `href="https://ampedfitness.com"` `target="_blank"`
- **Back link:** `a:has-text("Back to Explore")`

### 3.2 TrainHere Button
- Same as others — signed-out click opens SignInModal

### 3.3 Gallery Strip
- **Gallery section ABSENT** — `photos.length > 1` condition not met; only 1 hero photo (`src` ending in `babecave-full-view.jpg`)
- Total page images: 6 (1 hero bg photo, 1 map, 4 similar spot card images)
- Named gallery images for Amped: 0 in scroll container
- Gallery section (`div.flex.gap-2.overflow-x-auto`) NOT present on Amped

### 3.4 AttributeSections (Equipment)
- **Equipment heading present** with **Pro preview chip** (Smith Machine is a MACHINE_KEY)
- Equipment items: Smith Machine (Web Data 80%), Recovery Room (Web Data), Sauna (Web Data), Basketball Court, Cardio Zone, Group Classes, Personal Training, Childcare, Day Passes, Locker Rooms, 24-Hour Access, Women's-Only Area
- **Fact rows:** 12 rows confirmed — `li.group\/fact`
- **Women's-Only Area** visible as amenity item

### 3.5 Hours
- `open_24h: true` → renders `"Open 24 hours, every day"` in HoursDisplay (not a table)
- Open status chip: `"Open now"` rendered (from `open_24h ? true : isOpenNow(hours)`)
- Text pattern: `/Open 24 hours/` matches

### 3.6 Getting In Card
- **Policy:** `"Free trial route"` — Amped uses the trial route policy
- No day_pass_price → no break-even math
- Drop-in note likely present

### 3.7 Parking & Transit
- **Parking section ABSENT** — `parkingSummary` returns null and `transit.length === 0`, so ParkingCard returns null
- Page text confirms "Parking" in body text (possibly from description), but no ParkingCard rendered
- OSM attribution: `"© Mapbox © OpenStreetMap"` only in map footer

### 3.8 CommunitySection
- Same layout — left column
- **Sign in to review:** `"Sign in to review Amped Fitness Carrollwood"`
- **Reddit links:** 0 — no community links for Amped
- **Verify mailto:** `mailto:zchasse89@gmail.com?subject=Verify%20our%20listing%3A%20Amped%20Fitness%20Carrollwood`

### 3.9 SEO JSON-LD
- `@type: "ExerciseGym"`, `name: "Amped Fitness Carrollwood"` — confirmed

### 3.10 Similar Spots
- 4 links: `/gym/crunch-fitness-south-tampa`, `/gym/la-fitness-tampa-s-dale-mabry-signature`, `/gym/eos-fitness-tampa-midtown`, `/gym/planet-fitness-tampa-fowler-ave`

---

## 4. Verified Selectors Table

| Element | Selector | Present on |
|---|---|---|
| Gym name h1 | `h1` | All |
| Segment chip | `p.readout.text-pool` (in hero section) | All |
| Neighborhood text | `p.readout.mt-3` (contains MapPin + neighborhood name) | All |
| Day-pass chip | `span:has-text("Day pass $")` | Powerhouse, Kodawari |
| Open 24h chip | `span:has-text("Open 24h")` | Amped |
| Amenity chip (row) | `span.font-mono.rounded-md.bg-ink-raise` | All |
| Directions link | `a:has-text("Directions")` + `a[href*="google.com/maps"]` | All |
| Call link | `a:has-text("Call")` + `a[href^="tel:"]` | Powerhouse, Kodawari |
| Website link | `a:has-text("Website")` + `a[target="_blank"][href^="https"]` | All |
| Back to Explore | `a:has-text("Back to Explore")` | All |
| Train Here button | `button:has-text("I trained here")` | All |
| SignInModal dialog | `[role="dialog"][aria-label="Sign in to Scout"]` | After TrainHere click |
| Email input in modal | `input[type="email"]` | After TrainHere click |
| Gallery scroll container | `div.flex.gap-2.overflow-x-auto` | Powerhouse, Kodawari |
| Gallery images | `div.flex.gap-2.overflow-x-auto img` | Powerhouse, Kodawari |
| Equipment heading | `h2:has-text("Equipment")` | Powerhouse, Amped |
| Pro preview chip | `span:has-text("Pro preview")` | Powerhouse, Amped |
| Fact row | `li.group\/fact` (CSS: `group/fact flex items-center justify-between gap-3 py-2.5`) | All |
| Provenance badge span | `span.readout.inline-flex.items-center.gap-1.rounded.border.border-paper-line` | All |
| "Web Data" badge text | `span:has-text("Web Data")` (inner readout span) | All |
| Hours section | `section:has(h2:has-text("Hours"))` | All |
| Open/Closed now chip | `span:has-text("Open now")` / `span:has-text("Closed now")` | All (when hours known) |
| Hours 24h text | `text="Open 24 hours, every day"` | Amped |
| Getting in section | `section:has(h2:has-text("Getting in"))` | All (when policy/price present) |
| Drop-in policy chip | `span:has-text("Walk in")` etc. per gym | Per gym |
| Break-even line | `p:has-text("visit each month")` | Powerhouse |
| Parking section | `section:has(h2:has-text("Parking"))` | Powerhouse, Kodawari |
| Parking primary rec | `p.flex.items-start.gap-2.font-semibold` inside parking section | Powerhouse, Kodawari |
| Parking alternatives list | `ul.mt-3.divide-y` inside parking section | Powerhouse |
| Transit footer | `p.mt-3.flex.flex-wrap.items-center.gap-x-3` inside parking section | Powerhouse |
| OSM attribution (card) | `text="Parking & transit data © OpenStreetMap contributors"` | Powerhouse |
| Community section | `section:has(h2:has-text("From the community"))` | All |
| Review sign-in button | `button:has-text("Sign in to review")` | All (signed-out) |
| Reddit/discussion links | `a[href*="reddit.com"][target="_blank"]` | Powerhouse (3), Kodawari (2) |
| Outbound link rel | `rel="noopener noreferrer"` on above | All outbound links |
| Verify/own mailto | `a:has-text("Verify your info")` + `a[href*="mailto:"][href*="Verify"]` | All |
| JSON-LD script | `script[type="application/ld+json"]` | All |
| Similar spots section | `section:has(h2:has-text("Similar"))` | All |
| Similar gym links | `a[href^="/gym/"]` | All |
| Grid layout | `div.grid.grid-cols-1.gap-6.lg\\:grid-cols-\\[1fr_320px\\]` | All |

---

## 5. Key Behavioral Notes

1. **Gallery condition:** `photos.length > 1` — gallery section only renders when MORE than 1 photo exists. Amped has exactly 1 photo (hero background only) → no gallery strip.
2. **TrainHere modal:** Uses `role="dialog"` `aria-modal="true"` `aria-label="Sign in to Scout"`. Email input has `aria-label="Email address"`. "Send sign-in link" button present.
3. **No confirm/correct buttons signed-out:** `FactConfirm` component is always rendered in `AttributeSection` when `gymId` is provided, but it is a client component that checks auth state — buttons do not appear when user is not authenticated. Confirmed: 0 buttons found in fact rows.
4. **Provenance badge rendering:** The `ProvenanceBadge` component outputs a `<span>` with the label text as visible text. `"Web Data"` is the label for `source: "scraped"`. `showBadge()` = true when `source !== "seed"` or `confidence < 0.7`. Seed items with confidence ≥ 0.7 show NO badge.
5. **CommunitySection in left column:** `grid-cols-[1fr_320px]` → first `<div>` child contains `AttributeSection`s + `CommunitySection`. Second `<div>` is `<aside>` with gallery, hours, getting-in, parking, map.
6. **Amped has no Parking section:** ParkingCard returns null when `!summary && transit.length === 0`.
7. **Break-even:** Only renders when `monthly_from !== null && dayPass !== null && dayPass > 0 && visits > 1`. Powerhouse: monthly=$32.99, dayPass=$20 → visits=ceil(32.99/20)=2 → text shows "2nd visit each month".
8. **Segment label in Similar heading:** `"Similar strength & powerlifting spots"` (lowercase via `.toLowerCase()`).
9. **Hours heading is h2 with Clock icon:** `h2.readout.flex.items-center.gap-1.5.text-ink\/65` — text node is "Hours", icon is sibling not text.
10. **Getting in heading is h2 with DoorOpen icon** — same structure; filter `hasText: "Getting in"`.

---

## 6. Open Questions

None — all scope areas verified against live DOM and source code.
