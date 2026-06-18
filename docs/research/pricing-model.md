# Gym pricing & membership model — design

**Why:** real gym pricing is a *matrix*, not a number. A model with flat columns
(`monthly_from`, `day_pass_price`) can't represent commitment terms as a pricing
dimension, usage-based tiers, recoup fees (Crunch's annual "club enhancement
fee"), or early-termination terms. This designs a model that holds the full
variation space, stays **filterable** (Scout is a discovery app), and honors the
**never-fabricate** rule (everything nullable → "unlisted"). Knowing the *true*
cost (dues + enrollment + annual fee + commitment) is also the anti-extractive
"honesty nudge" differentiator.

## The full variation space (what real gyms do)

**1. Commitment term is a PRICE DIMENSION, not a flag.** A gym offers one or more
terms — month-to-month / 3-mo / 6-mo / 12-mo / paid-in-full-annual — and the
*same plan costs different amounts per term* (longer commitment = cheaper).
*NOEQL: annual (cheapest) / 6-month / month-to-month, each a different price.*

**2. Early termination — "what if you break the annual?"** buyout of remaining
months · flat early-termination fee · X months' dues · notice-only · none (MTM).
Material to true cost; users want "no-contract" gyms.

**3. Membership tiers/plans** — each a usage model + access scope + inclusions:
usage = unlimited / N visits per month or week / N classes per month
(*NOEQL tiers by visits/month*); scope = single-club / multi-club; hours = all /
off-peak; inclusions = classes, guest privileges, tanning/hydromassage, small-group
training (*Crunch Base vs Peak vs Black Card*).

**4. One-time fees** — enrollment / initiation / joining (often promo'd to $0),
activation/admin, key-fob.

**5. Recurring fees beyond dues** — **annual maintenance / "club enhancement"
fee** (*Crunch ~$50–60/yr* — how low-monthly clubs recoup), a.k.a. facility-
improvement fee. Charged once/year on an anniversary/set month.

**6. Pay-as-you-go** — day pass · week pass · punch cards · single class · class
packs (5/10/20) · unlimited-class monthly · intro offer (first week/class free,
intro month $X) · guest passes (free w/ membership, paid, member-accompanied —
the Life Time models).

**7. Discounts/variants** — student / military / senior / first-responder /
corporate / family-household / couple; seasonal promos.

**8. Policies (true-cost fine print)** — freeze/hold (fee?), cancellation notice
period + method, refund, add-on pricing (PT/SGT/classes/tanning as extra).

**9. Conditional access (Life Time)** — guest_policy_model, app-required,
waitlist, members-only.

## The model — two layers

**Layer 1 — normalized columns on `gyms` (for FILTER + the card headline).**
Derived as the cheapest/headline values so search stays simple:
- `monthly_from` *(exists)* — lowest monthly dues across all plans/terms → price filter anchor.
- `day_pass_price`, `week_pass_price` *(exist)*, `single_class_price`.
- `enrollment_fee` *(one-time, nullable — LT: expect null)*.
- `annual_fee` + `annual_fee_label` *(recurring maintenance; e.g. "Club enhancement fee"; Crunch $50–60)*.
- `min_commitment_months` *(0 = month-to-month)* and `no_contract_option` (bool) → **"no-contract" filter**.
- discount bools: `student_discount`, `military_discount`, `senior_discount`, `corporate_discount`, `family_plans`.
- access (LT): `guest_policy_model` enum, `app_required_entry`, `waitlist`, `members_guest_note`.

**Layer 2 — `membership_plans` JSONB array on `gyms` (the real matrix, for the
detail page + AI to reason over).** Each plan:
```jsonc
{
  "name": "Peak",                         // tier label
  "usage": { "type": "visits_per_month", "count": 8 },  // or unlimited / visits_per_week / classes_per_month
  "scope": "single_club",                 // | multi_club | null
  "hours": "all",                         // | off_peak | null
  "includes": ["classes","guest_privileges"],
  "prices": [                             // commitment term = price dimension
    { "term": "month_to_month", "monthly": 89 },
    { "term": "6_month",        "monthly": 79 },
    { "term": "12_month",       "monthly": 69 }
  ],
  "notes": null
}
```

**Layer 1.5 — policy fields** (`early_termination` JSONB `{type, amount, note}`
where type ∈ buyout_remaining | flat_fee | months_dues | notice_only | none;
`cancellation_notice_days`; `freeze_policy` text; `intro_offer` text;
`class_packs` JSONB `[{count, price}]`; `pricing_notes` text catch-all).

**Filterable now (FilterSet):** price (`monthly_from`/`day_pass_price`), and
`no_contract_option`. Everything else is display + AI-readable (the NL parser/edge
can reason over `membership_plans` + policy fields for "no-contract gym under $30",
"gym with a 3x/week plan"); we promote more to hard filters as demand shows.

## Worked examples (proof it holds)

**NOEQL** (real record; usage tiers × terms):
`monthly_from: 69`, `min_commitment_months: 12`, `no_contract_option: true`,
`membership_plans:` [ {name:"3x/mo", usage:{visits_per_month:3}, prices:[{mtm:X},{6mo:Y},{12mo:Z}]}, {name:"Unlimited", usage:{unlimited}, prices:[…3 terms…]} ],
`early_termination: {type:"buyout_remaining"}`.

**Crunch** (low monthly + recoup fee):
`monthly_from: 9.99`, `annual_fee: 59`, `annual_fee_label:"Club enhancement fee"`,
`enrollment_fee: 0` (promo), `membership_plans:` [Base, Peak(multi-club), Black Card(tanning+hydromassage+guest)], each MTM + annual price; `min_commitment_months: 12` on the cheaper tiers, `no_contract_option: true` on Base.

**Life Time Harbour Island** (members-only exclusive):
`monthly_from: null`, `enrollment_fee: null`, `guest_policy_model:"members_only_waitlist"`, `waitlist: true`, `app_required_entry: true`, `membership_plans: null` (gated) — honestly mostly "unlisted."

**Yoga studio** (class economics):
`monthly_from: 120` (unlimited), `single_class_price: 28`, `class_packs:[{count:10,price:220}]`, `intro_offer:"First week free"`, `membership_plans:`[{name:"Unlimited", usage:{unlimited}, prices:[{mtm:140},{12mo:120}]}].

## What it means for the owner form (pricing section)

The pricing section becomes: (1) day-pass/drop-in + class economics (as now,
segment-aware); (2) **enrollment fee** + **annual fee (with label)**; (3) a
**"+ Add a membership plan" repeater** — name, usage (unlimited / N per month
or week / classes), then a small price-by-term grid (MTM / 6-mo / annual); (4)
**commitment + cancellation** — terms offered, min months, early-termination
(buyout / flat fee / notice-only / none), freeze policy; (5) discounts
(student/military/senior/corporate/family chips). All optional, all skippable to
null. Prefill from scraped data where present.

## Migration impact (revises #5)

`gyms_pricing_and_access` adds: `enrollment_fee`, `annual_fee`,
`annual_fee_label`, `single_class_price`, `class_packs` (jsonb), `intro_offer`,
`min_commitment_months`, `no_contract_option`, `early_termination` (jsonb),
`cancellation_notice_days`, `freeze_policy`, `membership_plans` (jsonb),
discount bools, `guest_policy_model` (enum/text), `app_required_entry`,
`waitlist`, `members_guest_note`, `pricing_notes`. All nullable. (Replaces the
earlier flat `joining_fee/annual_fee/contract_model` sketch.)
