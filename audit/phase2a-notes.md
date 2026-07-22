# Phase 2a — DATA INTEGRITY & HONESTY (implementation notes)

Handoff for reviewer. No commit / push / deploy / migration apply was performed.

## What changed (per brief item)

### 1. Nine dead amenity keys (P1#4)
- **New migration file** `supabase/migrations/20260722000002_missing_amenity_keys.sql`
- Inserts into `public.amenities`: `chalk_allowed`, `wheelchair_accessible`,
  `accessible_restrooms`, `hydromassage`, `open_gym`, `props_provided`,
  `retail_shop`, `spin_studio`, `tanning`.
- Labels match `AMENITY_LABELS` in `scout.ts`. Categories follow existing
  conventions (`strength` / `facility` / `recovery` / `class`).
- `on conflict (key) do nothing` — safe re-apply.
- **Reviewer must apply** before filters referencing these keys can match
  `gym_amenities` rows (FK).

### 2. nlParser word-boundary + longest-phrase span claim (P1#5)
- `src/lib/search/nlParser.ts`:
  - Replaced `text.includes(phrase)` with `(^|\W)phrase(\W|$)` matching
    (`phraseMatches` / `firstPhraseSpan`).
  - Amenity/equipment/segment synonyms match via **global longest-phrase-first
    with non-overlapping span claiming** so multi-word equipment phrases win
    over short segment tokens (e.g. `"box jumps"` claims the span before
    segment `"box"` → crossfit).
  - Vibes, brands, neighborhoods also use word-boundary matching.
- **New** `src/lib/search/nlParser.test.ts` — collision corpus + positives +
  `24/7` / `24 hour`.

**Product-semantics note:** Span claiming is cross-dict (amenity ∪ equipment ∪
segment). A longer equipment phrase can suppress a shorter overlapping segment
synonym in the same span. That is the honest fix for the audit collisions;
queries like `"crossfit box"` still hit crossfit via the longer `"crossfit"`
phrase (non-overlapping remainder / separate phrase).

### 3. Kill `?? "Tampa"` (P1#6)
- `GymCard.tsx`: neighborhood chip renders **only when** `gym.neighborhood` is
  non-null. No fabricated city name.
- Map popup (`waypointPin.ts`): same honesty — omit empty neighborhood rather
  than a blank ` · ` prefix.
- **Choice:** least-invasive option (hide chip) over threading city name through
  every card caller. City context already lives in the page/route; fabricating
  a metro name on a card without neighborhood is worse than silence.

### 4. `safeHttpUrl` (P1#7)
- **New** `src/lib/safeUrl.ts` + `src/lib/safeUrl.test.ts`.
  - Accepts http/https only; bare domains get `https://` prefix (land/fetch
    convention); rejects `javascript:`, `data:`, `//evil.com`, other schemes.
- **Render:** gym detail website + Instagram hrefs; `GymJsonLd` `sameAs`.
- **Write:** `scripts/land.mjs` website field (plain-JS mirror).

### 5. Hours honesty (P2)
- **`hours.ts` closing-soon:** overnight close wraps (+1440) so evening stretch
  and morning carry-over can show "Closes soon" with correct remaining minutes.
  Active close prefers yesterday's overnight when still inside that window.
- **`isOpenNow`:** checks yesterday's overnight range first (carry-over), then
  today's range (including same-day overnight). Missing today with no carry-over
  stays `null` (unknown) — never fabricated closed.
- **Missing-day display:** `openStatus` → `"Hours not listed today"` (+ next-open
  hint when a future day exists). `formatHoursLines` / `HoursDisplay` use
  `"Hours not listed"` instead of `"Closed"` for absent day keys.
- **`openDuringStay` unchanged:** still counts absent weekdays in a populated
  map as closed for trip planning (documented divergence in scorer comment —
  stay planning vs live open/closed).
- Tests: `scorer-hours.test.ts` extended; **new** `hours.test.ts`.

### 6. GymCard image `onError` (P2)
- `GymCard`: on image error → state flag → `SegmentScene` placeholder (mirrors
  PhotoGallery drop-failed pattern; card keeps a visual instead of a broken
  glyph).
- Map popup has no photo thumb today — no change needed there beyond
  neighborhood honesty above.
- Trip UI uses GymCard / openStatus paths already covered.

## Verification

```
npx tsc --noEmit   → exit 0
npx vitest run     → 18 files, 387 tests passed
```

## Deliberately not done
- No commit, push, deploy, or migration apply.
- No `.env*` touch.
- Did not change FilterSet four-surface contract beyond nlParser matching
  (amenity keys already in TS/synonyms/edge; DB insert is the missing surface).
- Did not alter `openDuringStay` missing-day = closed for trip tallies
  (different product question than live open/closed).
- Did not add photo thumbs to map popups (none exist).
- Did not gate admin/owner write paths beyond land.mjs (brief scoped render +
  land write).

## Reviewer checklist
1. Apply `20260722000002_missing_amenity_keys.sql` via Supabase MCP / SQL.
2. Spot-check `select key from amenities where key in (...)` — 9 rows present.
3. Smoke: NL fallback `"running track"` / `"good energy"` / `"box jumps"` should
   not apply false equipment/segment filters when edge is rate-limited.
4. Gym card without neighborhood shows no fabricated "Tampa".
5. Gym detail with a `javascript:` website (if any stale row) hides Website link.
6. Overnight gym near close shows "Closes soon"; Sat 01:00 under Fri overnight
   reads open.
