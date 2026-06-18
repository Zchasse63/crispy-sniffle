# Partner Outreach, Owner Form & Monetization — Plan

**Status:** Proposed (multi-agent design + adversarial monetization scrutiny, 2026-06-10). Grounded in locked decisions in [PLAN.md](../../PLAN.md) (owner self-serve form line 94; partner thesis lines 99–100; P2 monetize). Companion to [metro-data-pipeline.md](metro-data-pipeline.md).

**One-line thesis:** Build the owner form in-house, scrape each metro *first* and email owners *second* with a "we already built your free listing — confirm it" hook, and monetize **app users** (thin premium) as the leakage-immune floor while gyms pay an **optional flat fee** (never a take-rate) as the upside.

---

## A. Form tool — BUILD it (don't buy)

**Verdict: custom Next.js route (`/own/<token>`) on existing Supabase. Do not use Typeform/Tally/Jotform/Fillout.**

Five of six hard requirements collide with how hosted form tools work; the sixth (voice) we already own a better version of:
- **Per-gym prefill at ~1,000 gyms/metro** means every owner needs a uniquely-prefilled form. Hosted tools do this via hidden fields fed by URL params — so we'd build the tokenization + prefill-data generation in our backend *anyway*, and still pay per-response and surrender the data flow.
- **The provenance contract is non-standard.** Every field needs `source`+`confidence`, and "owner-confirmed-a-prefill" vs "owner-typed-fresh" vs "owner-left-prefill" are three different provenance outcomes from one widget. No SaaS form emits that.
- **Voice is our existing surface** (Web Speech → Claude). Reusing it is near-zero marginal cost; the tools with native audio (Jotform/Fillout) hand back a blob we'd transcribe ourselves anyway.
- **Per-response economics punish us at metro scale** ($34–129/mo tiers, paying per submission for data we already scraped) vs ~$0.001–0.01/submission custom (Haiku parse on infra we already pay for).
- **First-party data rule (CLAUDE.md rule 8)** + the contract-drift that killed the prior build both argue against a third-party form.

**Fallback only if outreach must ship before the form is built:** Tally (free, unlimited submissions, save-resume, hidden-field prefill, webhooks) as 2–4 week disposable scaffolding — with native Web Speech voice swapped in (Tally has no voice recorder). Treat as throwaway, not the destination.

| Requirement | Custom | Tally | Jotform | Fillout | Typeform |
|---|---|---|---|---|---|
| Tokenized, no-login | ✅ mint tokens | ✅ | ⚠️ | ✅ | ✅ |
| Save-and-resume cross-device | ✅ DB-keyed | ⚠️ same-browser | ✅ emailed link | ❌ no save | ⚠️ browser-local |
| Voice-note capture | 🟢 reuse our pipeline | ❌ | ⚠️ blob only | ✅ (AI transcribe = paid) | ❌ |
| Prefill scraped answers | ✅ render row values | ⚠️ hidden fields | ⚠️ | ⚠️ | ⚠️ |
| Write owner-provenance facts | ✅ native | ❌ | ❌ | ❌ | ❌ |
| Cost @ ~1k responses/metro | infra + ~$1–10 Claude | $0–24/mo | $34/mo | $19+/mo | $50/mo |

---

## B. Form content & UX — easy, chunked, schema-mapped

**Design contract:** every closed answer maps 1:1 to a `scout.ts` enum so the parser does near-zero inference. Free-text + voice are the only inputs Claude truly "extracts." Prefill everything scraped; the owner's job is to **confirm or correct**, not author. Two rules in every question: prefilled chips render pre-selected with a "from your website" tag; **"don't know / skip" is always one tap** and a skip stays `null` ("unlisted"), never coerced to `false` (never-fabricate rule).

### Two paths, one progressive form
- **SHORT — "Confirm the basics" (~90s–2.5min) → "Owner Listed" badge.** Sections: identity, hours, **pricing**, women's-only, + a one-screen amenity chip pass. The highest-value, most-perishable, hardest-to-scrape facts. The continue/stop seam sits right after pricing — a gym that bails here has still given us the crown jewels.
- **FULL — "Complete your listing" (~3–8min) → "Gym Verified" tag.** Adds branched equipment, parking detail, vibe, photos, and the voice note. "Complete" is defined *per segment* by branching (a yoga studio needn't fill powerlifting), plus ≥1 photo. Unlocks machine-granularity ("Pro preview"), gallery, vibe boosts, richest match reasons.

### Sections (each answer → schema field)
- **A. Identity** — confirm name/address (also the token-identity check), phone, website; **primary segment** (MC-single, 1:1 `gym_segment`) — *this drives all branching*; optional secondary segments (soft, Kodawari).
- **B. Hours** — "open 24h?" toggle (skips the grid); prefilled weekly grid with "same as Mon–Fri" bulk apply; close-time "12am" stored end-of-day per `isOpenNow`.
- **C. Pricing** *(lead here — most valuable, most perishable, hardest to scrape)* — drop-in policy (MC-single, 1:1 `DropInPolicy`); day-pass + week-pass price; "lowest monthly from"; membership/drop-in notes as free-text (parsed to a note, **not** exploded into columns — avoids the prior-build phantom-column trap).
- **D. Amenities** — one chip wall, each chip = one `AmenityKey`; unchecked ≠ absent (only a toggled-off prefill writes `false`).
- **E. Equipment (BRANCHED by segment)** — equipment is ground truth, so ask precisely but only what's plausible: full free-weights+racks+machine-granularity+powerlifting for strength/big_box/luxury; lighter for CrossFit/MMA/climbing; a single "any strength equipment?" toggle for yoga/recovery. Count steppers ("how many squat racks?", "heaviest dumbbell?") power filters. Optional brands row.
- **F. Parking** — kind (MC-single, 1:1 `ParkingKind`), access/cost (1:1 `ParkingAccess`), fee detail. Writes one `is_primary` record.
- **G. Women's-only** — its own clear MC-single question (entire facility vs dedicated area vs neither), never buried in chips.
- **H. Vibe** *(full only)* — up to 3 `VibeTag` chips + "what makes you different?" free-text. Soft signals only.
- **I. Photos** *(full only)* — multi-upload with subject-tag prompts ("main floor", "rack area", "recovery") → galleries + alt text + future vision passes.
- **J. Anything else** *(always last, optional)* — the escape hatch: big mic button (Web Speech, identical to app voice search) + free-text. "Talk for 30 seconds about what makes your gym special — we'll sort out the details." → transcribe → Claude extract → review queue.

### Save-and-resume (mandatory — busy owners do this between sets)
The tokenized link **is** the session. Every change autosaves (debounced ~800ms) to `owner_submissions` as a `draft` keyed to the token — no save button, nothing to lose, reopens on any device exactly where they left off. Progress shown two ways (top bar = % of *applicable* post-branch sections; a section checklist drawer for non-linear jumping). Returning lands on "Welcome back — you're 60% done, pick up at Equipment?" Two badge thresholds drive motivation ("✓ Owner Listed unlocked" the moment SHORT completes; a ring toward "Gym Verified"). Explicit "Submit for review" flips `draft → submitted`; further edits open a new draft revision, never mutate the queued one.

---

## C. Ingestion architecture

End-to-end: tokenized link → no-login form → autosave/resume → submit → Claude Haiku parse (+ voice transcription) → staged `owner`-tier facts → human-review queue (override-aware) → publish (badges + live read). All inside the provenance ladder (`owner` rank 5 outranks `scraped`/`estimated`) and the never-fabricate rule.

### Trust model — why no-login is safe
The **token is the authorization** (same posture as `ai-search` `verify_jwt=false`): a row binds one opaque 256-bit secret to exactly one `gym_id`; possession = permission to edit that gym and nothing else. New tables are **deny-all to anon** (RLS, no policies); all access goes through `security definer` RPCs / an edge fn that hashes the raw token, looks up the gym, and **forces every write to `gym_id = invite.gym_id` server-side** — the client payload can never name another gym.

### Token design
- `raw = base64url(randomBytes(32))` in the email path (`/own/<raw>`, path not query → stays out of Referer logs). Store **only** `sha256(raw)` — a DB leak can't reconstruct live links.
- One invite = one gym; `expires_at = now()+60 days` (renewable only by re-issuing); `status: sent→opened→in_progress→submitted→consumed/revoked`.
- Validation choke point (`owner-portal` edge fn): apikey gate + per-IP rate limit (10/min) + per-token-hash counter; **return identical generic 404 + latency** for bad/expired/revoked so it's not a validity oracle. Uploads go to a private `owner-uploads/<gym_id>/` bucket whose prefix the server computes.

### Schema (new migration)
- **`owner_invites`** (token_hash unique, gym_id, email, status, expiry, submit_count).
- **`owner_submissions`** (gym_id, invite_id, status `draft|submitted|in_review|published|rejected`, `raw_answers jsonb` = resume payload + audit source, `parsed_facts jsonb`, `voice_transcript`, `completeness`, contact name/role, reviewer_id, `parse_model`). Partial unique index = one open draft per invite.
- **`owner_fact_log`** (per-fact audit: target_table, fact_key, action `insert|override|skip|reject`, prev_value+prev_source, new_value+new_source, reviewer_id) — full lineage from token → transcript → reviewer.
- **`gyms`** gains `owner_listed`, `gym_verified`, `is_partner` booleans.

### AI parse (edge fn `owner-parse`, mirrors `ai-search`)
Two passes: (1) **voice transcription** (Web Speech interim transcript + server-side Whisper-class on the uploaded blob → `voice_transcript`, treated as free-text, never sole ground truth); (2) **structured extraction** — Haiku, strict JSON, schema = the exact enum lists, `temperature:0`. **Confidence guardrail:** multiple-choice answers → conf 0.98; free-text/voice-extracted → carry LLM conf capped at 0.9; un-asked/un-volunteered → stays null. `present:false` only when the owner explicitly said "no" (owner-confirmed absence outranks a scraped presence). All land as `source:'owner'`; confidence differentiates within the tier. Nothing touches catalog tables until publish.

### Human-review queue (mandatory before publish)
Staff `/admin/owner-queue` shows a **per-fact diff** (current source·conf vs owner says·conf, with action). Owner rank 5 ≥ everything below, so default = **override**; conflicts surfaced not dropped (owner-asserts-absence vs existing-presence → ⚠ confirm; owner vs `scout_verified` → reviewer must consciously decide). A human clicks Publish/Reject/Request-more-info — never auto-publish, because a bad extraction would poison the top tier. Publish is one transactional `security definer` RPC: upsert facts at `source:'owner'`, write `owner_fact_log`, **re-sync the `gym_amenities('parking')` filter boolean** (same "no trigger" caveat as the parking loader), set badges (`owner_listed` on any fact; `gym_verified` when completeness ≥ 0.8), bump `updated_at` (detail is `force-dynamic`, so the live read picks it up — no rebuild).

### ⚠️ Two findings flagged for implementation
1. **Latent schema drift (pre-existing):** the `gym_amenities` / `gym_equipment` `source` CHECK constraints omit `osm`/`city_data`, unlike `gym_parking`/`gym_transit`/`scout.ts`. Fix in the owner-form migration so the override step can write any provenance uniformly.
2. **The "sixth surface":** the `owner-parse` prompt is a new copy of the AMENITIES/EQUIPMENT/SEGMENT/VIBE enum lists (after rail/parser/edge/scorer). It must import from `scout.ts` (or be injected at deploy) and be added to the FilterSet "update-together" rule in CLAUDE.md — otherwise a newly-added amenity silently won't parse from owner forms.
3. **Loader guard:** re-running `enrich.mjs` after an owner publish must not clobber `source:'owner'` rows — add a rank guard to its upserts (`do update … where excluded source-rank ≥ existing`, or skip when existing is `owner`/`scout_verified`).

---

## D. Outreach engine & pitch

### Sequencing — scrape FIRST, email SECOND (answers the "email ahead to save money" idea)
**The email-before-scrape idea is a net negative — don't do it.** The math: the cost you'd "save" by getting owners to self-fill is only the **~$10–35 extraction layer** (discovery is $0 either way). Even if 5% of a 1,000-gym metro self-fills, you must still scrape the other ~950 to have a product — so you save ~$0.50–$1.75/metro while throwing away your single biggest lever: the **pre-filled-listing hook lifts replies from ~9% to ~18% (2×)**, and it only works once a listing exists. **Spend the cheap thing (scraping) to unlock the valuable thing (2× reply rate + a product that ships day one).** Owner contributions then upgrade scraped 0.85 → owner rank-5 and compound on the *freshness* loop, not the one-time extraction.

**So:** build listings → ship as `scraped` tier → run outreach in parallel with launch as a *continuous funnel* (new gyms from the monthly Overture/FSQ diff auto-enroll).

### Infrastructure (Resend, already in stack)
- **Dedicated outreach subdomain** (`partners.scout-gym.com`) added as a separate Resend domain so cold-volume complaints never touch the transactional/auth reputation of the root. From a real human ("Zach at Scout"), monitored Reply-To.
- **Auth:** Resend auto-handles SPF/DKIM; add the custom Return-Path records; publish DMARC `p=none` during warm-up → `p=quarantine` after 2 clean weeks.
- **Warm-up & pacing:** ramp ~5–10/day (wk1) → ~30–50/day max per inbox. A 1,000-gym metro = ~20–35 sending days for touch 1 — fine, because listings are built on a rolling basis and slow sending is healthy. Need faster? add a second inbox, don't crank past ~50/day.
- **Bounce/complaint handling (non-negotiable):** webhook `bounced`/`complained`/`delivered`/`opened` → `outreach_events`. Hard bounce → suppress address; **complaint → suppress whole gym**. Global suppression list checked before every send (suppressed / unsubscribed / already-submitted / already-partner). Keep bounce < 2–3%, complaints < 0.1% — which is why scraped real `mailto:` addresses beat inferred role addresses.
- **Compliance (CAN-SPAM, B2B is legal):** truthful headers, a real physical postal address in the footer, one-click tokenized unsubscribe honored immediately + `List-Unsubscribe` header. (Penalties up to ~$53k/email.)

### Email-finding ladder (cheapest first; mostly $0)
Discovery already yields website (~91%), phone, socials, often email. So this is a *residue* problem: (0) use the email already in Overture/FSQ → (1) regex `mailto:` from the already-cached `/contact`,`/about` pages — **no re-crawl** → (2) social profile contact button → (3) infer role address (`info@`>`contact@`>`hello@`) + MX/SMTP verify (~$0.006/check; treat catch-all domains as unverified) → (4) paid enrichment (~$0.10–0.50/record) for high-value residue only. Net: usable address for the large majority at **$0 marginal cost**.

### Sequence — 3 touches over ~12 days, then stop
Follow-ups roughly double total replies; 3 touches is the sweet spot (the first follow-up alone adds ~49%; ~93% of replies arrive by day 10).

| Touch | Day | Angle |
|---|---|---|
| 1 | 0 | Pre-filled-listing hook: "We built your free Scout listing — confirm/correct it in 2 min." |
| 2 | 3 | Same-thread nudge: "the #1 thing owners fix is their price + equipment — yours is partly unlisted." |
| 3 | 10 | Last touch: "closing the Tampa verification batch this week — want Verified before it locks?" then **stop**. |

Hard-stop on: replied, submitted, unsubscribed, hard-bounced, complained. **No touch 4.** Send Tue–Thu mid-morning local.

### The pitch — why it's worth 2 minutes (Q6)
Owners are pitch-fatigued (ClassPass/Mindbody/lead-gen). Scout's wedge is being explicitly the opposite. Lead with the free, controllable, verified listing; then the killer line: **"Scout sends you members and you keep 100% of the revenue — we don't sit between you and your customer, we don't take a cut, we're not ClassPass."** That line directly answers the "what's the catch" reflex and earns the reply. The pitch is *their* free listing, not the company. Honesty is the pitch: show real scraped facts + one real `unlisted` gap (the itch to fix); never invent a fact to look impressive — a wrong guess destroys trust with the one person who knows the truth.

### Email Draft A — initial cold (Touch 1)
> **From:** Zach at Scout `<zach@partners.scout-gym.com>` · **Subject:** Your {gym_name} listing on Scout — quick confirm?
>
> Hi {gym_name} team,
> I'm Zach, building Scout — a new way people in Tampa find the *right* gym (by equipment, vibe, and amenities, not just "gyms near me").
> We already built a free listing for {gym_name} from public info, and it's getting in front of people searching in {neighborhood}. I want to make sure it's right before more people see it.
> Here's what we have so far:
> • {fact_1}
> • {fact_2}
> • Day-pass price: **unlisted** — couldn't confirm this one
> Could you take **2 minutes** to confirm or fix it? No account, no cost — just a link (you can even reply by voice note from the gym floor): **→ {listing_url}**
> Why it's worth it: Scout sends you local members and **you keep 100% of the revenue.** We don't sit between you and your customers, we don't take a cut, and we're not ClassPass. Confirming gets {gym_name} a **"Verified"** badge so it ranks ahead of unverified listings.
> Thanks, Zach — Scout
> *Scout · [postal address] · [Unsubscribe in one click]({unsub_url})*

### Email Draft B — follow-up (Touch 2, same thread)
> **Subject:** Re: Your {gym_name} listing on Scout — quick confirm?
> Hi again — quick nudge in case the last one got buried.
> The one thing most owners fix first: their **day-pass / membership price and equipment list** — that's what people filter on in Scout, and right now {gym_name}'s is partly **unlisted**, so you're invisible to anyone searching for it.
> Takes about 2 minutes, no account needed (voice note works too): **→ {listing_url}**
> And the catch? There isn't one. Scout is free for gyms, we never take a percentage of your memberships, and your info stays yours.
> Appreciate it, Zach — Scout
> *Scout · [postal address] · [Unsubscribe in one click]({unsub_url})*

---

## E. Monetization — recommended model

Three theses were generated (B2C-primary, B2B flat-fee SaaS, Hybrid-marketplace) and adversarially scored by three skeptical lenses (cost/benefit, competitive reality, disintermediation). **All scored ~6.3/10 — no clean winner** — so the recommendation takes each thesis's best-scored component and discards its weakest bet.

### The model: B2C floor + B2B ceiling, never a take-rate

| Payer | Product | Price | Role |
|---|---|---|---|
| **App users** | **Scout+** — machine-level equipment filters, full travel/trip matching, unlimited saves + followed-gym alerts, visit-log savings analytics | **$4.99/mo or $39.99/yr**, 7-day trial | **Primary FLOOR** — immune to leakage, covers data cost many times over |
| **Gyms (free)** | **Listed** — profile, owner-tier facts, Owner Listed / Gym Verified badges | **$0 forever** | Supply flywheel + funnel top |
| **Gyms (paid)** | **Partner** — visitor analytics, lead/attribution dashboard, photo uploads, comment replies, soft-boost placement (Kodawari-bounded), member-outreach | **$39/mo or $390/yr**, single tier | **Secondary CEILING** — gated behind a *proven* consumer audience |

**One paid gym tier, not three** (the scores punished tier-inflation): $39 clears an owner's impulse-yes, is under half of Mindbody's cheapest line, and avoids the "why is $99 worth it" renewal problem.

### The three questions, answered
- **Take-% vs flat fee vs user-monetization?** **Never a percentage** (a take-rate *is* the ClassPass/Mindbody mechanism the north star rejects). **Flat fee** on the gym side, but only as the *secondary* line (gym willingness-to-pay for a discretionary marketing tool is real but soft and cold-start-exposed). **User-monetization is the primary floor** — the one revenue line no lens could find a leakage hole in.
- **The "Stripe Connect 15% commission" line → DROP it entirely.** Replace with **Stripe Billing** for Scout+ subscriptions + flat Partner SaaS. No Stripe Connect, no commission, no booking rail at P2. Cutting booking from P2 removes the heaviest build (payout routing, QR attribution, exclusive pricing) for the thinnest, most leakage-exposed revenue. Booking becomes a P3 *convenience* hand-off (gym keeps 100%), never a P2 monetization dependency.
- **Direct-purchase leakage (user buys at the front desk, we see nothing)?** **We recover ~0% of that transaction, by design, and that's correct — not a failure.** Plugging the leak *is* rebuilding ClassPass (exclusivity + attribution tax + a take-rate). The leak is unwinnable for anyone honoring the north star, so **we exit the fight**: revenue is structurally orthogonal to where the checkout lands. The user already paid us (Scout+) for *discovery*; a Partner gym already paid a flat fee for *visibility + the attribution report*; neither depends on the transaction. A direct purchase is the north star being **kept** ("the gym wins and keeps its own member"). We capture the leak as **data** — a free "Scout drove this member" attribution event reported back to the gym — which is *why* a gym pays the flat fee, but we never tax the dollar.
- **Is it better to monetize users? Data costs money.** Yes — users are the floor. And data is cheap (~$20–35/metro mostly one-time + a few $/mo freshness, per the pipeline doc), so a handful of Scout+ subs per metro covers it; gym revenue is upside, not a necessity. The honesty nudge ("3 passes cost $75; a membership is $50") only ships under a flat-fee/subscription model — a take-rate platform earns more from the worse-for-the-user outcome and could never say it.

### Sequencing
- **BETA (now) — everything free.** Full app free; travel free (locked); machine-granularity badged "Pro preview — free during beta"; beta users pre-announced as grandfathered. Owner form live as the partner funnel only ($0). **Critical pre-work the scores demand: instrument analytics NOW** (PostHog/Plausible — repo has none) + capture emails for the Scout+ launch list. Goal: a real, *measured* MAU/engagement baseline.
- **P2 — monetize. GATE = a measured consumer loop, not a date.** Scout+ launches first on Stripe Billing (Auth arrives to anchor subs); Partner SaaS launches *second*, only once there's an audience to sell — gyms see real visitor numbers *before* the ask (mitigates cold-start). DROP Stripe Connect/commission/booking.
- **P3 — scale. GATE = Partner volume + attribution plumbing.** Full honesty nudge; owner-opt-in referral bounties (gym sets price, buys a qualified lead — the *only* gym-pays-per-outcome mechanism allowed, because it's gym-as-advertiser and a "direct" signup *is* the billable event); adjacent affiliate (equipment/apparel mapped to the amenity taxonomy); reviews-as-verification; booking-as-free-convenience if ever.

### Rough revenue model — one mature metro (adversarially-corrected assumptions)
Using a conservative base (the scores caught every thesis inflating MAU, conversion, and the gym denominator):
- **Payable gym denominator ≈ 300**, not 1,000 (the ~1,000 is raw Overture POI count incl. trainers/yoga/pilates; gyms that pay a software bill are a fraction).
- **MAU 10,000/metro** (well below every thesis's 40–80k); **Scout+ conv 3%** @ ~$3.10/mo blended; **Partner conv 3%** of payable @ $39/mo.

| Line | Calc | Annual |
|---|---|---|
| Scout+ (floor) | 10,000 × 3% = 300 × ~$3.10/mo | ~$11,160 |
| Partner (ceiling) | 300 × 3% = 9 × $39/mo | ~$4,210 |
| **Metro total (conservative)** | | **~$15,400** |
| Loaded cost (data + human-review labor + Stripe + infra) | | ~$4,000–6,000 |
| **Net contribution/metro** | | **~$9–11k (~2–3× over cost)** |

**Honest verdict:** even the **bear case covers data cost hundreds of times over** — that question is settled. The open risk is **business viability above data cost**, which rides entirely on MAU acquisition + Partner conversion — the variables the analytics instrumentation (the P2 gate) exists to measure before spending on expansion. Each additional metro is near-pure contribution margin; one metro does **not** fund a team, which is the correct expectation.

### How it ties to the funnel
The form is the **CAC-killer**, not a monetization surface — it pays twice (revenue + lower data COGS). Ramp: scrape → **Listed (free)** → tokenized cold email → owner completes form → **Gym Verified** (free; they've now *experienced the product*) → the form's terminal screen is the monetization fork ("Want to see who's searching for gyms like yours? → Start Partner, $39/mo, first 30 days free"). The free analytics preview is the hook: once an owner sees "38 people tapped Directions to a competitor this month," the flat fee sells itself against a real number.

### Open decisions for the user
1. **Instrument analytics this week (non-negotiable).** Every revenue number rests on an unmeasured MAU; repo has no PostHog/Plausible/gtag. Without a baseline the P2 gate is un-evaluable.
2. **Real payable-gym denominator in Tampa** (I modeled ~300 of ~1,000) — swings Partner revenue ~3×.
3. **Does consumer WTP exist for a finder?** (gym discovery is low-frequency.) Run a fake-door price test in beta before building the full Scout+ paywall.
4. **Confirm killing the booking rail at P2** — forecloses per-transaction revenue until P3 (the scores say that GMV was never collectible without becoming ClassPass).
5. **One Partner tier or two?** Collapsed to one $39 for cold-start; a $79 upper tier is a post-P2 data decision.
6. **Human-review-queue staffing** — who reviews, and at what volume does it need triage/partial automation (auto-approve high-confidence Haiku parses, human only for conflicts)?
7. **Beta grandfathering scope** — free-forever vs lifetime-discount vs 1-year-free.
8. **Referral bounties (P3)** — ship opt-in/capped, or cut entirely to keep "we take nothing, period" absolutely clean?

---

## Build order (when implementing — architect-first per CLAUDE.md)
1. **Analytics instrumentation** (PostHog/Plausible) — unblocks every gate. Do first.
2. **`owner_submissions.sql` migration** (invites/submissions/fact-log/badges + the flagged CHECK-constraint fix + bucket + 3 RPCs) → mirror `database.ts`/`scout.ts`.
3. **Edge fns** `owner-portal` (token-scoped draft read/write/submit) + `owner-parse` (Haiku + transcription) — full-source deploy + curl live-test.
4. **Form route** `/own/[token]` — reuse `scout.ts` label maps + the Web Speech voice component; autosave/resume; SHORT→FULL progressive flow.
5. **Admin** `/admin/owner-queue` + `publish_owner_submission` RPC + `owner_fact_log`.
6. **Outreach** `scripts/owner-invite.mjs` (Resend, subdomain, suppression) + the 3-touch sequence + bounce/complaint webhooks.
7. **Monetization** (P2, gated) — Stripe Billing for Scout+, then Partner tier. No Stripe Connect.

---

## FIRST TRIAL RUN — The Sauna Guys + NOEQL (planned 2026-06-18; do later)

Before any cold outreach, dogfood the **whole owner-form → ingestion → publish pipeline** on two real gyms Zach controls, so we can fill every field truthfully and test photos end-to-end. This is the acceptance test for the partner funnel.

**The two trial gyms:**
- **The Sauna Guys (Tampa, FL — Zach owns it).** NOT in Scout yet → must be **added as a new gym record first** (segment `recovery`, city `tampa`, address/phone/website). Then trial the form to fill its details + upload **real photos** (Zach has them). First owned-business listing.
- **NOEQL Training Co. (Tampa — partner gym).** Already in DB but under the **stale slug `cigar-city-crossfit`** (pre-rebrand), segment `crossfit`, has address/phone/website/10 equipment/4 photos but **NO pricing**. The form trial fills the gap — especially NOEQL's **tiered membership matrix** (frequency-based tiers × annual/6-mo/month-to-month commitment, annual being cheapest), which is exactly what the membership-plan repeater + pricing model were built for. Consider migrating the slug to `noeql-training-co` (301 the old one) while we're at it.

**Prerequisites (must be true before the trial — "everything live"):**
1. **Deploy current work** so prod = local (pending SEO fixes etc. pushed; Netlify green).
2. **Build the `owner_submissions` ingestion backend** (steps 2–3 + 5 above): the form is a localStorage prototype today — to test the *full* pipeline (submit → human review → publish at `owner` tier) we need `owner_invites`/`owner_submissions`/`owner_fact_log` + `owner-parse`/`owner-portal` edge fns + the `/admin/owner-queue` review screen + `publish_owner_submission` RPC, and the form's persistence swapped localStorage → Supabase. (This is also the admin-portal review-queue MVP block — see [admin-portal-spec.md](admin-portal-spec.md); the trial *motivates* building it.)
3. **Add The Sauna Guys** gym record so it has a `/own/<token>` to fill.

**Trial steps (later):**
1. Mint real tokenized invites for both gyms (`owner-invite.mjs`).
2. Fill the form as the owner for each (Zach has all the info), upload real photos.
3. Submit → review in `/admin/owner-queue` → publish at `owner` tier.
4. Verify both gyms' live pages show owner-verified data + the **Gym Verified** badge, photos in the gallery, and NOEQL's full pricing matrix rendering.

**Why these two:** owned + partner = we can answer every field honestly, no cold-outreach dependency, and they validate both ends of the spectrum (a recovery/sauna studio with no equipment but rich amenities/photos; a CrossFit box with deep equipment + a complex tiered-pricing structure). Green here = the funnel is real.
