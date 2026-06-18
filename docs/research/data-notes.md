# Data collection notes — hard-to-scrape facts & policy nuances

Manually-known facts that are hard or impossible to scrape reliably, and that
expose gaps in our data model. These are the cases the owner self-serve form and
human review exist to capture. **Source is noted per entry; verify before
treating as published fact** (most are domain knowledge, not yet site-confirmed).

---

## Life Time (chain) — guest / drop-in policy is conditional & per-location

**Source:** user domain knowledge, 2026-06-18, **now partly verified** by scraping
18 real premium LT clubs — see [lifetime-research.md](lifetime-research.md) for the
full coverage report + per-location data + the 18 records to seed.

**What the scrape verified / corrected (18 clubs):**
- LT publishes **address, phone, hours, amenities** consistently (18/18) and one
  **"starting at $X/month" anchor** on most (13/18). It **hides the real economics.**
- **Enrollment fee: published on 0/18.** The "up to ~$1,000" figure is **unverified** —
  no club lists it; only a historical third-party $200 (PBG, 2022). → enrollment_fee
  is an **owner/manual-only** field; expect null from scraping.
- **Day-pass price: ~$50–$100, confirmed** — but on a dedicated daypass page for only
  **9/18** ($50 Scottsdale → $100 NYC, clustered by metro). The rest are inquiry-gated.
  Several third-party day-pass numbers (Boca $40, Walnut Creek ~$100, Frisco) are
  **unverified** — store only page-verified prices; leave the rest null.
- **Not all LT are "members' guests only."** Four models seen: **(A) public day pass**
  (most common), (B) inquiry/members-first no public price, (C) members-only + waitlist
  (Harbour Island, West Boca, NYC Premier), (D) member-invited guest (chain-wide: app +
  QR + photo ID, **same guest once per 60 days**; member-invited passes are *free*,
  distinct from the paid day pass). → needs a `guest_policy_model` field, not a single
  drop-in enum.
- **App-required is corporate policy, never on a location page** — applies to
  member-*invited* guests; paid day passes are bought via web order, often no app.
- **Tier label: published on 0/18** — never printed; "Signature" is a membership *type*,
  not a club tier. Don't infer "Diamond" from reviews. tier = owner/manual.
- **Harbour Island specifically:** members-only with an **active confirmed waitlist**
  (reported 10k+ at opening), **no public day pass, no monthly price published** — so our
  current `membership_only` is actually defensible *for this club* (it's a Model C
  exclusive), but the chain-wide `membership_only` generalization is wrong.

*(Original user-stated policy retained below for reference.)*

**Current Scout record (as of 2026-06-18) — too absolute, likely wrong:**
`life-time-harbour-island` → `drop_in_policy = membership_only`,
drop_in_note "Membership club — join via inquiry; no public day-pass route",
all prices null. Reality below shows there usually IS a (conditional) guest path,
so `membership_only` over-states the wall.

**The real policy (varies by location):**
- **Some locations allow a regular drop-in / guest pass** — price ranges roughly
  **$50–$100** (varies by club).
- **Other locations only allow a guest when accompanied by a member.** Even then
  the drop-in rate can **still apply** if: (a) the member is out of guest passes,
  or (b) that guest has already visited on that member's pass this month.
- **"Exclusive" / smaller clubs (e.g. Harbour Island, Tampa)** may have a
  **waitlist** and/or an **enrollment fee of up to ~$1,000**.
- **App / profile requirement:** guests typically must create a profile in the
  **Life Time app before arriving**. Some clubs require this, some don't — but
  it's faster with the app because guests can **buy guest passes directly** in it
  and **receive guest passes from a member** through it.

**Why this matters / what it breaks in our model:**
1. `drop_in_policy` enum (`walk_in | book_first | restricted | trial_route |
   membership_only`) has no value for **"members' guests only, with a conditional
   drop-in rate."** `restricted` is the closest but loses the nuance.
2. `day_pass_price` is a single number — it can't express a **$50–$100 range**,
   a **member-conditional** rate, or a separate **enrollment fee** (up to ~$1,000)
   or **waitlist** state. These need their own fields/notes.
3. **App-required entry** (pre-register, buy/receive guest passes in-app) is a real
   access barrier worth surfacing to a user before they drive over — same spirit
   as the parking-intelligence differentiator. No field for it today.
4. Per-location variance means a chain-level answer is wrong; each Life Time needs
   its own record. Good candidate for **owner-confirmed** data (the conditional
   logic is exactly what scraping misses).

**Actions (not yet done):**
- [ ] Verify Harbour Island specifics on lifetime.life (guest policy, enrollment
      fee, waitlist, app requirement) and correct the record — soften
      `membership_only` to reflect the conditional guest path, add an
      enrollment-fee + app-required note.
- [ ] Consider data-model additions: enrollment/initiation fee, day-pass price
      *range* (or min/max), "members' guests only" drop-in variant, app-required
      entry flag. Fold into the owner-form pricing/access section + the
      [partner-outreach-plan](partner-outreach-plan.md) form spec.
