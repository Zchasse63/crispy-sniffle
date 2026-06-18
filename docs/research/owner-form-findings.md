# Owner Form — Real-World Walkthrough Findings

**Source:** adversarial multi-persona audit (24h big-box GM, yoga/Pilates owner, strength/CrossFit owner) + technical-reliability + data-coverage auditors, 2026-06-18. 54 raw findings → deduped/prioritized below. Checkboxes track fix status.

## TOP 8 TO FIX NOW
1. [ ] **Badges reachable with zero data** (C1) — Skip marks sections "complete," so tapping through earns Gym Verified on nothing.
2. [ ] **No contact identity** (C2) — no name/role/email; can't verify submitter or stop sabotage.
3. [ ] **No cardio equipment in taxonomy** (C3) — no treadmill/elliptical/bike/stairmaster anywhere.
4. [ ] **Pricing can't tell the truth** (C4) — no class packs, intro offers, joining/annual/enrollment fees, contract flag. (= the Life Time gap.)
5. [ ] **Segment radio silently prunes equipment questions** (C5) — secondaries inert; owner never warned.
6. [ ] **Hours fabricate availability** (C8) — auto-fill 6a–9p, no split hours, no per-day 24h, no overnight.
7. [ ] **Pilates/MMA equipment can't be entered** (C6) — no reformer/props, no bag/ring/cage.
8. [ ] **Photo upload silently drops iPhone photos** (C9) — HEIC + >5MB fail with no feedback.

## CRITICAL (wrong data / blocks owner / breaks on phone)
- [ ] **C1 Skip = confirmed → fake badges.** Compute badge eligibility from `isAnswered()` over each section's *visible* fields, not `completedSections.length`. Skip advances WITHOUT marking complete. *(never-fabricate)*
- [ ] **C2 No contact identity / anti-abuse.** Add identity step: name (req), role, email (req), optional phone → wire to reserved `contactName`/`contactRole`; gate publish on emailed confirm.
- [ ] **C3 No cardio equipment.** Add `treadmill/elliptical/upright_bike/recumbent_bike/stair_climber` EquipmentKeys + a Cardio chip group. *(FilterSet 4-surface change)*
- [ ] **C4 Pricing structures.** Add class pack (count+price), single-class price, intro offer, joining/initiation fee, **enrollment fee**, annual fee, contract tri-state; drive pricing labels off segment (class studios see "Single class / Class pack"). *(never-fabricate; = Life Time)*
- [ ] **C5 Segment prunes equipment; secondaries inert.** Union primary+secondary branches in `visibleFields()`, or keep strength sub-questions for crossfit/mma; hint that segment reshapes later questions. *(never-fabricate)*
- [ ] **C6 Studio/combat equipment unrepresentable.** Add yoga/Pilates apparatus (`reformer`+count, `tower`, `cadillac`, `chair`, `barrel`, `aerial`, `props`) and combat (`heavy_bag`, `boxing_ring`, `mma_cage`, `mats`). *(FilterSet change)*
- [ ] **C7 Hidden non-branch prefill ships unreviewed.** On submit/segment-change, strip equipment answers for fields not in the active branch. *(never-fabricate)*
- [ ] **C8 Hours fabricate availability.** No auto-fill default (blank until entered); per-day 24h toggle; multiple windows/day (HoursMap→array); overnight (close<open = next day); appointment/class-only toggle→null; validate; align `isOpenNow`. Also fix the `open_24h` flag leaking into the per-day map. *(never-fabricate; = user ask)*
- [ ] **C9 Photo stub drops phone photos.** New `owner-photos` bucket (~15MB) or raise limit; accept/convert HEIC; client validate size/type, cap ~8, thumbnails+remove, downscale ~2000px, progress/retry, don't swallow errors; real photo answer shape so photos count as answered. *(never-fabricate; = user ask)*

## IMPORTANT (friction / missing coverage)
- [ ] **I1 Drop-in/guest/trial is single-choice but reality is multiple.** Keep primary single-choice; add tri-states "free first visit?" and "guests welcome with a member?"; class-studio "drop in to a class (booking req)". Segment-aware. *(= Life Time members'-guest case)*
- [ ] **I2 `c_daypass` hidden by wrong condition.** Broaden `showIf` so a single day-pass price isn't demanded for restricted/trial/conditional policies.
- [ ] **I3 Equipment binary — big-box scale invisible.** Optional per-machine quantity for high-value machines; give conditioning branch the rack-count + heaviest-DB steppers; brand-per-category.
- [ ] **I4 Missing amenities.** `tanning`, `hydromassage`, `spin_studio`, `retail_shop`, `props_provided`, `open_gym`, `chalk_allowed`. *(FilterSet change)*
- [ ] **I5 Segment enum gaps.** Add `cycling/spin` + `barre` segments (+ `spin_bike`); track dance/gymnastics/swim/physio later.
- [ ] **I6 No accessibility/age.** Add `accessibility` chip (wheelchair/accessible restrooms) + `min_age` (all/13+/16+/18+) + youth toggle.
- [ ] **I7 No identity-field validation/mobile affordances.** `type=tel/url` + inputMode; on blur prepend https, light phone digit check; non-blocking inline warnings.
- [ ] **I8 CurrencyInput accepts NaN/negatives/absurd.** Guard `Number.isFinite`, clamp ≥0, round 2dp, soft upper-bound warnings, echo parsed value. *(never-fabricate: typo blanks price)*
- [ ] **I9 No draft TTL / config-version stamp.** Enforce 30-day `lastSaved`; add `CONFIG_VERSION`; on resume intersect answer keys with current field set, drop orphans.
- [ ] **I10 No review-before-submit summary.** Final recap screen listing every answer + flagging "unlisted" before owner-tier publish.
- [ ] **I11 DictationMic loses text 3 ways.** Branch `onerror` (mic-blocked vs no-speech); functional-update append; flush interim on stop; Safari caveat + max-duration.
- [ ] **I12 MilestoneOverlay no scroll/focus/dismiss.** `overflow-y-auto max-h-[90dvh]`, body-scroll lock, focus trap, Escape, `role=dialog aria-modal`, underlying form inert.

## NICE-TO-HAVE / LATER
- [ ] N1 Don't prefill `c_notes` from concatenated scraped marketing copy; voice replaces not appends-after-boilerplate.
- [ ] N2 StepperField step=5 can't express 47.5lb top DB; allow 2.5 / free numeric; let counts sit on 0. *(minor never-fabricate)*
- [ ] N3 Women's-only: add "predominantly women (not exclusive)" soft option; consider moving off the short path.
- [ ] N4 Vibe gaps (`instructor_led`, `wellness`, `family_friendly`, `inclusive`); reconsider hard 3-cap.
- [ ] N5 Photo suggestion chips segment-aware (studios: reformer floor / retail / café).
- [ ] N6 Chip tap targets <44px on mobile; group machine wall; 2-col layout + count.
- [ ] N7 Full milestone re-fires on review re-entry; add `shownFull` guard.
- [ ] N8 No year-established / chain affiliation (optional, high owner-pride).
- [ ] N9 After-hours entry mechanics (staffed / keyfob / app entry) — rides with the 24h staffed-vs-access fix + the Life Time app-required note.

**Never-fabricate roll-up:** C1, C4, C5, C7, C8, C9, I8, N2.
