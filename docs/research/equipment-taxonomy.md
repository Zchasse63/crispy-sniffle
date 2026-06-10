# Scout Canonical Equipment Taxonomy v1
**Research basis:** manufacturer catalogs (Life Fitness/Hammer Strength/Cybex, Technogym, Precor, Matrix, Core Health & Fitness, Panatta, Atlantis, Prime, gym80, Watson, Arsenal, Booty Builder, Westside, REP, FreeMotion) + ownership verification as of June 2026. Designed to be consumed by an engineering orchestrator: every machine type has a stable `snake_case` slug, every stored key has a value type, every brand string maps to inference rules.

---

## 1. Brand Landscape (~30 brands)

### 1.1 Who owns what (verified, current)
- **Life Fitness Holdings** owns Life Fitness, **Hammer Strength**, and **Cybex** (Cybex still actively sold — Eagle NX selectorized line, Arc Trainer).
- **Core Health & Fitness** owns/licenses **StairMaster, Star Trac, Nautilus (commercial), Schwinn (commercial), Throwdown**.
- **Johnson Health Tech** owns **Matrix** (commercial) and bought consumer **BowFlex/Schwinn retail** out of 2024 bankruptcy — the consumer "Nautilus Inc." is dead; commercial Nautilus (Core H&F) is alive and unrelated.
- **Peloton** still owns **Precor** (attempted sale fell through; runs as standalone subsidiary).
- **TRUE Fitness** owns **Octane Fitness** (since 2020).
- **iFIT** owns **FreeMotion**.
- **Kabuki Strength** collapsed and relaunched as **Kabuki Power** (bars still in production).

### 1.2 Brand table

| Brand | Segment | One-line positioning | Decision weight for gym-goers |
|---|---|---|---|
| **Hammer Strength** (Life Fitness) | Strength, plate-loaded | The global default for plate-loaded iso-lateral machines + HD racks; "serious gym" baseline | **High** — its presence/absence splits casual vs strength gyms |
| **Life Fitness** | Big-box full-line | Default cardio + Insignia/Optima selectorized; Symbio premium cardio | Low — operator choice, neutral signal |
| **Cybex** (Life Fitness) | Big-box strength/cardio | Eagle NX selectorized + the Arc Trainer; legacy fleet everywhere | Low-Med |
| **Technogym** | Premium lifestyle full-line | Italian design-led: Selection 900/700, Pure Strength plate-loaded, Excite cardio, Artis, SkillMill | Med — proxies "upscale club" |
| **Precor** (Peloton) | Big-box/hospitality | EFX elliptical inventor, AMT, Resolute/Icarian strength; hotel default | Low |
| **Matrix** (JHT) | Big-box full-line | Ultra/Versa/Aura selectorized + Magnum racks & plate-loaded; aggressive in chains | Low-Med (Magnum = strength investment signal) |
| **Hoist** | Mid-market selectorized | ROC-IT rocking-pivot selectorized; 24 Hour Fitness/hotel staple | Low |
| **Nautilus** (Core H&F) | Mid big-box selectorized | Inspiration/Impact/Leverage lines; **Glute Drive** = hip thrust machine | Med (Glute Drive specifically) |
| **Star Trac** (Core H&F) | Cardio | Treadmill/bike floor filler; FreeRunner | Low |
| **StairMaster** (Core H&F) | Cardio (stepmill) | THE stepmill (4G/8G/10G Gauntlet); category-defining | **High** — "do they have StairMasters and how many" is a real query |
| **Concept2** | Conditioning ergs | RowErg/SkiErg/BikeErg; the only rower that matters competitively | **High** — conditioning-gym marker |
| **Assault Fitness** | Conditioning | AssaultBike fan bikes + AssaultRunner curved manual treads | **High** — HIIT/CrossFit marker |
| **Rogue** | Strength/conditioning infra | Monster/Monster Lite rigs-racks-bars, Echo Bike, GHDs; CrossFit + powerlifting default | **High** — barbell-first gym marker |
| **Eleiko** | Olympic/powerlifting premium | IWF/IPF-cert bars, calibrated plates, platforms, Prestera racks | **High** (niche) — weightlifting-grade signal |
| **Kabuki Power** (ex-Kabuki Strength) | Powerlifting specialty | Transformer/Duffalo specialty bars, New Gen power bar | Med (niche) |
| **Westside Barbell** | Powerlifting specialty | Reverse Hyper (invented it), ATP belt squat, Inverse Curl (Nordic) | **High** (niche) — conjugate/posterior-chain signal |
| **Titan Fitness** | Budget strength | Budget racks/bars; in a commercial gym ⇒ low-budget indie | Low (tier-down signal) |
| **REP Fitness** | Prosumer→light commercial | PR-4000/5000 racks, Ares/Athena cables, now Strive air bike/curved tread; indie-gym favorite | Med |
| **Arsenal Strength** | Strength specialty (US) | Reloaded plate-loaded + M1 selectorized; USA-made bodybuilding iron | **High** — bodybuilding-gym marker |
| **Prime Fitness** | Strength specialty premium | SmartStrength variable-resistance torque arms; Prodigy HLP racks; influencer-gym darling | **High** — bodybuilding/"Instagram gym" marker |
| **Watson** (UK) | Strength specialty premium | UK heavy-duty plate-loaded (Animal line) + machined dumbbells | **High** (rare in US) |
| **gym80** (DE) | Strength specialty premium | Sygnum selectorized + Pure Kraft plate-loaded; German engineering cult | **High** (rare in US) |
| **Atlantis** (CA) | Strength specialty premium | Laval, QC; precision plate-loaded + selectorized; bodybuilder-revered | **High** |
| **Panatta** (IT) | Strength specialty premium | Monolith/FitEvo/SEC selectorized + Freeweight HP/Special plate-loaded; deepest leg-machine catalog on earth | **High** — destination-gym marker |
| **Booty Builder** (NO) | Glute specialty | Invented the dedicated hip thrust machine (Platinum V4, V8, Dual, Standing) + glute suite | **High** — glute-training segment |
| **FreeMotion** (iFIT) | Cable-functional + cardio | Genesis Dual Cable Cross lineage; incline trainers; 22-Series iFIT cardio | Med (functional trainer presence) |
| **TRUE Fitness** | Cardio (hospitality/community) | Stryker slat tread, Alpine Runner; owns Octane; Palladium strength | Low |
| **Octane** (TRUE) | Low-impact cardio | Standing/recumbent ellipticals, Zero Runner, LateralX; medical/55+/hotel | Low |
| **WaterRower** | Boutique cardio | Wooden water-resistance rowers; boutique/hotel aesthetic piece | Low |
| **Keiser** | Pneumatic strength + cycle | Air-resistance machines (rehab/athletic/active-aging) + M3i — the spin-studio bike | Med (M3i ⇒ real cycle studio) |
| **EGYM** (DE) | Smart selectorized circuit | RFID auto-adjusting connected circuit; YMCA/municipal/beginner retention play | Med — beginner-friendly signal, enthusiast anti-signal |

### 1.3 Which brands actually matter for choosing a gym
**Rule: cardio brand = operator decision (noise); strength brand = member-visible signal.** Nobody picks a gym because treadmills are Matrix vs Precor. People absolutely pick gyms for: Hammer Strength rows, a Panatta/Atlantis/Prime/Arsenal/Watson/gym80 machine floor, Rogue racks + platforms, StairMaster count, Concept2/Assault conditioning zones, a Booty Builder/Glute Drive, and Westside-style specialty pieces. The strength-specialty brands (Panatta, Atlantis, Prime, Arsenal, Watson, gym80, Booty Builder) are **destination signals** — gyms advertise them by name and lifters travel for them. Big-box full-line brands (Life Fitness, Precor, Matrix, Technogym, Core H&F) matter only as **tier proxies** (Technogym/Artis ⇒ upscale; worn mixed fleet ⇒ budget).

---

## 2. Canonical Category Taxonomy

Eight categories. Each machine type gets: slug, aliases (for scrape/NLP matching), muscle tags (`glutes|quads|hamstrings|back|chest|shoulders|arms|core` + `calves` extension), rarity (U=ubiquitous, C=common, UC=uncommon, R=rare — rarity drives signal value).

### 2.1 FREE_WEIGHTS
| Slug | Aliases | Muscles | Rarity | Notes |
|---|---|---|---|---|
| `power_rack` | squat rack, cage, half rack, squat stand | quads, glutes, full-body | U | **Count matters** (queue bottleneck) |
| `smith_machine` | guided barbell | full-body | U | Visually distinct; count matters |
| `olympic_platform` | deadlift platform, lifting platform | back, glutes, hamstrings | UC | With bumpers ⇒ oly-friendly |
| `bench_press_station` | flat bench, incline bench station, comp bench | chest, shoulders, arms | U | Dedicated barbell benches, count |
| `adjustable_bench` | utility bench | — | U | Noise except count |
| `dumbbells` | DB rack | full-body | U | **Max weight is the key attribute** |
| `fixed_barbells` | barbell rack, EZ curls | arms | C | Noise |
| `specialty_bars` | SSB, safety squat, trap/hex bar, cambered, swiss, axle, deadlift bar | varies | UC | Powerlifter signal |
| `preacher_curl_bench` | scott bench | arms | C | Free-weight version |
| `landmine` | core trainer, T-bar pivot | back, core | C | Cheap, semi-noise |

### 2.2 MACHINES_PLATE_LOADED
| Slug | Aliases | Muscles | Rarity | Notes |
|---|---|---|---|---|
| `hack_squat` | linear hack | quads, glutes | C | Classic "serious leg day" marker |
| `pendulum_squat` | Panatta super squat | quads, glutes | **R** | Cult item; lifters travel for it |
| `leg_press_45` | 45° leg press, linear leg press | quads, glutes | U | Count matters |
| `vertical_leg_press` | — | quads, glutes | R | Old-school signal |
| `v_squat` | lever squat, squat press | quads, glutes | UC | |
| `belt_squat` | hip belt squat, Pit Shark, Rhino, ATP | quads, glutes | **R** | Powerlifter + bad-back magnet |
| `hip_thrust_machine` | Booty Builder, Glute Drive, thrust bench | glutes, hamstrings | UC→C (rising) | Distinguish dedicated machine vs barbell+pad setup |
| `glute_kickback_machine` | standing kickback, donkey kick | glutes | UC | |
| `iso_chest_press` | Hammer iso flat/incline/decline/wide | chest, shoulders, arms | C | Iso-lateral = independent arms |
| `iso_shoulder_press` | Hammer OHP | shoulders, arms | C | |
| `iso_row` | iso low row, seated row PL | back, arms | C | |
| `iso_high_row` | Hammer high row | back | UC | Enthusiast favorite |
| `plate_lat_pulldown` | iso front pulldown | back, arms | C | |
| `t_bar_row` | chest-supported row | back | C | |
| `shrug_machine` | — | back | UC | |
| `standing_calf_plate` / `seated_calf` | calf raise | calves | C | Seated calf classically plate-loaded |
| `pullover_machine` | Nautilus pullover, Prime/Panatta pullover | back, chest | **R** | Cult classic, strong differentiator |

### 2.3 MACHINES_SELECTORIZED
| Slug | Aliases | Muscles | Rarity | Notes |
|---|---|---|---|---|
| `leg_extension` | — | quads | U | Noise |
| `leg_curl_seated` | — | hamstrings | U | |
| `leg_curl_lying` | prone leg curl | hamstrings | C | **Both variants present = enthusiast signal** |
| `leg_curl_standing` | single-leg curl | hamstrings | UC | |
| `hip_abductor` | outer thigh | glutes | U | Noise individually |
| `hip_adductor` | inner thigh | adductors (tag: glutes) | U | Noise |
| `multi_hip` | 4-way hip, cable hip swing | glutes | UC | |
| `leg_press_selectorized` | seated/horizontal leg press | quads, glutes | U | Big-box circuit staple |
| `chest_press_machine` | seated chest press | chest, arms | U | Noise |
| `pec_deck` | fly machine, rear-delt fly combo | chest, shoulders | U | Noise |
| `shoulder_press_machine` | — | shoulders, arms | U | Noise |
| `lateral_raise_machine` | side raise machine | shoulders | **UC** | NOT universal — real differentiator |
| `lat_pulldown_machine` | fixed-stack pulldown | back, arms | U | Noise |
| `seated_row_machine` | — | back, arms | U | Noise |
| `back_extension_machine` | low-back machine | back, glutes | C | Noise |
| `ab_crunch_machine` | rotary torso, torso twist | core | U | Noise |
| `bicep_curl_machine` | preacher machine | arms | C | Noise |
| `tricep_machine` | dip/extension machine | arms | C | Noise |
| `assisted_pullup` | Gravitron, assisted dip/chin | back, arms | U | Noise |
| `smart_circuit` | EGYM circuit, e-resistance | full-body | UC | Beginner/retention signal |

### 2.4 CABLES_FUNCTIONAL
| Slug | Aliases | Muscles | Rarity | Notes |
|---|---|---|---|---|
| `cable_crossover` | cable cross, dual stack | chest, full | U | |
| `functional_trainer` | adjustable dual pulley, FreeMotion Genesis, FT, HLP | full-body | C | Adjustable arms distinguish from fixed crossover |
| `cable_station_single` | adjustable pulley column | full-body | C | |
| `multi_jungle` | 4-stack/8-stack, jungle gym | back, full | C | **Total independent stack count is the metric** |
| `suspension_rig` | TRX zone | full-body, core | C | Noise-ish |

### 2.5 CARDIO (motorized / steady-state)
| Slug | Aliases | Rarity | Notes |
|---|---|---|---|
| `treadmill` | — | U | Count only (capacity) |
| `incline_trainer` | FreeMotion/NordicTrack 30%+ | UC | 12-3-30 crowd cares |
| `elliptical` | EFX, cross-trainer | U | Noise |
| `adaptive_motion` | Precor AMT, Octane XT-One | UC | |
| `arc_trainer` | Cybex Arc | C | |
| `stepmill` | StairMaster, Gauntlet, stair climber | **C but scarce-per-gym** | **Count is a top-5 query**; chronic queues |
| `versaclimber` | vertical climber, Jacobs Ladder | R | Boutique HIIT signal |
| `upright_bike` / `recumbent_bike` | — | U | Noise |
| `spin_bike` | Keiser M3i, Schwinn AC, Stages | C | Fleet ⇒ cycle studio |
| `zero_runner` / `lateralx` | Octane | R | Low-impact niche |
| `upper_body_ergometer` | UBE, arm bike | UC | Adaptive/rehab signal |

### 2.6 CONDITIONING (self-powered / HIIT)
| Slug | Aliases | Rarity | Notes |
|---|---|---|---|
| `rower_erg` | Concept2 RowErg, WaterRower | C | Brand matters (C2 = standard) |
| `ski_erg` | Concept2 SkiErg | UC | Functional-gym marker |
| `bike_erg` | Concept2 BikeErg | UC | |
| `air_bike` | AssaultBike, Rogue Echo, Airdyne, Strive | C | HIIT marker |
| `curved_treadmill` | AssaultRunner, Woodway Curve, TrueForm | UC | Self-powered; athletic signal |
| `turf_strip` | sprint track, sled lane | C | Pairs with sled |
| `sled` | prowler, push sled | C | |
| `pullup_rig` | crossfit rig, wall rig | C | Rogue-class rigs |
| `plyo_boxes`, `battle_ropes`, `wall_balls`, `kettlebells`, `slam_balls` | — | U-C | Bundle as `functional_zone`, individually noise |

### 2.7 SPECIALTY_POWERLIFTING (strength-sport)
| Slug | Aliases | Muscles | Rarity | Notes |
|---|---|---|---|---|
| `ghd` | glute-ham developer, glute-ham raise | hamstrings, glutes, core | UC | CrossFit + powerlifting crossover |
| `reverse_hyper` | Westside RH, Scout Hyper, Rogue RH-2 | glutes, hamstrings, back | **R** | High-signal; back-friendly posterior work |
| `nordic_bench` | Nordic curl, inverse curl, Freak Athlete | hamstrings | **R** | Rising fast |
| `combo_rack` | comp bench/squat combo, ER rack | — | R | Sanctioned-meet-grade gym |
| `monolift` | — | — | R | Geared/conjugate signal |
| `calibrated_plates` | comp plates, Eleiko discs | — | R | |
| `deadlift_bar` | Texas DL bar, Okie | back | UC | Under `specialty_bars` umbrella |
| `chains_bands` | accommodating resistance | — | UC | |
| `strongman_kit` | yoke, farmers handles, log, atlas stones, axle | full-body | R | Bundle as one flag |
| `jerk_blocks` | oly blocks | — | R | Weightlifting club signal |

### 2.8 RECOVERY (amenity-class, not machines — but Scout-decision-critical)
| Slug | Aliases | Rarity | Notes |
|---|---|---|---|
| `sauna` | traditional/infrared | C | Top-3 amenity query |
| `steam_room` | — | UC | |
| `cold_plunge` | ice bath | UC (rising fast) | Strong 2025-26 demand driver |
| `hot_tub` / `pool` | whirlpool | UC | |
| `hydromassage` | water massage bed | C (PF/Crunch) | Chain-tier amenity |
| `massage_chair` / `percussion` | Theragun bar | C | Noise-ish |
| `compression_boots` | Normatec | UC | Boutique recovery signal |
| `red_light` | RLT bed/panel | UC | |
| `stretch_area` | stretch cage, turf stretch zone | U | Noise |

---

## 3. Recommended STORED-KEY Set (25 keys)

**Selection logic:** store what is (a) variably present across gyms (rarity UC/R, or count-constrained like racks/stepmills), (b) actually queried by gym-shoppers (training-segment deal-breakers), and (c) detectable from photos/scrapes/reviews. Everything ubiquitous (leg extension, pec deck, lat pulldown…) collapses into one coverage score instead of individual keys — storing them as first-class keys is noise that bloats UI and vision pipelines for zero decision value.

| # | Key | Type | Why it's decision-relevant |
|---|---|---|---|
| 1 | `squat_rack_count` | int | #1 bottleneck and #1 lifter question; 1 rack vs 8 racks = different gyms |
| 2 | `deadlift_platform` | bool + int | Deadlift/oly permission proxy; many big-boxes have zero |
| 3 | `bench_station_count` | int | Second-worst queue item |
| 4 | `dumbbell_max_lbs` | int | The single best one-number proxy for gym seriousness (50 = PF-class, 100 = standard, 150+ = bodybuilder gym) |
| 5 | `smith_machine_count` | int | Universally asked; glute/quad programming staple |
| 6 | `specialty_bars` | enum set (`ssb`,`trap`,`deadlift`,`cambered`,`swiss`,`axle`) | Powerlifter/athlete segment filter |
| 7 | `hip_thrust_station` | enum (`none`/`barbell_setup`/`dedicated_machine`) | Glute training is a top search driver; dedicated machine (Booty Builder/Glute Drive) is a destination feature |
| 8 | `hack_squat_count` | int | Canonical "real leg day" machine; absent from many chains |
| 9 | `pendulum_squat` | bool | Rare, cult-demand; instant differentiator |
| 10 | `belt_squat` | bool | Rare; powerlifters + back-injury lifters specifically search it |
| 11 | `leg_press_45_count` | int | Expected everywhere; count separates real capacity |
| 12 | `ghd` | bool | CrossFit/posterior-chain marker |
| 13 | `reverse_hyper` | bool | Rare, high-intent (powerlifting/back rehab) |
| 14 | `nordic_bench` | bool | Rising demand, still rare — early data moat |
| 15 | `cable_stack_count` | int | "Never enough cables" is the most common gym complaint; count all independent stacks (crossovers + FTs + jungle) |
| 16 | `functional_trainer` | bool | Adjustable dual-pulley presence (FreeMotion/Prime HLP class) |
| 17 | `leg_curl_variants` | enum set (`seated`,`lying`,`standing`) | Both seated+lying = enthusiast-grade machine floor |
| 18 | `calf_raise_variants` | enum set (`standing`,`seated`) | Standing calf is vanishing from chains; bodybuilders notice |
| 19 | `lateral_raise_machine` | bool | Surprisingly non-universal; frequent enthusiast query |
| 20 | `plate_loaded_tier` | enum (`none`/`basic`/`hammer_class`/`boutique_premium`) | Derived from brand hints (§4); compresses 15 iso-machine booleans into one signal |
| 21 | `stepmill_count` | int | Top cardio differentiator; chronic queues; "how many StairMasters" is a literal user query |
| 22 | `rower_count` | int | Conditioning capacity (Concept2-class) |
| 23 | `air_bike_count` | int | HIIT/conditioning capacity |
| 24 | `turf_sled` | bool | Functional/athletic zone marker (turf strip + sled) |
| 25 | `oly_lifting_ok` | bool | Bumpers + platform + policy (no "no chalk/no dropping" signs); weightlifting segment gate |

**Explicit noise (do NOT store as keys):** treadmill/elliptical/bike counts beyond a single `cardio_capacity` int; leg extension; pec deck; chest/shoulder press machines; lat pulldown; seated row; ab/adductor/abductor; assisted pull-up; preacher machine; benches; TRX; small functional kit. Roll these into a derived `machine_coverage_score` (0-100, % of the §2.3 checklist present) if wanted for ranking — never as user-facing filters.

**Recovery amenity keys (store separately as amenities, not equipment):** `sauna`, `steam_room`, `cold_plunge`, `hydromassage`, `red_light`, `pool_hot_tub`. Sauna and cold plunge are top-5 gym-choice drivers in 2026 and must be filterable.

---

## 4. Brand-String → Category/Inference Hints (scrape + vision)

Match these strings in scraped gym websites, Google/Yelp reviews, Instagram captions, and on-equipment logos/decals in photos. Confidence: **H** = safe to auto-assert, **M** = assert with corroboration.

| String cues | Implies equipment | Implies gym segment/tier | Conf |
|---|---|---|---|
| `Hammer Strength`, `Iso-Lateral`, `HD Elite` | Full plate-loaded suite (`iso_*`), racks | `plate_loaded_tier ≥ hammer_class`; serious-strength big-box | H |
| `Panatta`, `Freeweight HP`, `Freeweight Special`, `FitEvo`, `SEC`, `Monolith` | Premium plate+selectorized; **pendulum_squat highly likely** | `boutique_premium`; destination bodybuilding gym | H |
| `Atlantis` (strength context) | Premium plate-loaded + selectorized; lever squats, pulldown variety | `boutique_premium` | H |
| `Prime`, `SmartStrength`, `Prodigy`, `HLP` | Variable-cam plate-loaded, hybrid racks, extreme-row | `boutique_premium`; influencer/bodybuilding gym | H |
| `Arsenal`, `Reloaded`, `M1` (strength context) | US premium plate-loaded | `boutique_premium` | H |
| `Watson`, `Animal` (UK equip context) | Heavy plate-loaded (hack/pendulum/leg press), machined DBs ⇒ `dumbbell_max_lbs` high | `boutique_premium` | H |
| `gym80`, `Sygnum`, `Pure Kraft` | German selectorized + plate-loaded | `boutique_premium` | H |
| `Booty Builder` | `hip_thrust_station = dedicated_machine`; glute suite (abductor, kickback, belt squat) | Glute-focused/women's-strength segment | H |
| `Glute Drive` (Nautilus) | `hip_thrust_station = dedicated_machine` | — | H |
| `Westside`, `ATP`, `Reverse Hyper`, `Scout Hyper`, `Inverse Curl` | `reverse_hyper`, `belt_squat`, `nordic_bench` | Powerlifting/conjugate gym | H |
| `Pit Shark` | `belt_squat` | Powerlifting | H |
| `Rogue`, `Monster`, `Ohio Bar`, `Echo Bike` | Rigs/racks/platforms/bars, GHD, air bike | Barbell-first (CrossFit, powerlifting, S&C) | H |
| `Eleiko`, `Prestera`, `IWF`, `calibrated` | Platforms, comp bars/plates ⇒ `oly_lifting_ok`, `combo_rack` likely | Weightlifting/powerlifting-grade | H |
| `Kabuki`, `Transformer Bar`, `Duffalo` | `specialty_bars` rich | Powerlifting | H |
| `Sorinex`, `EliteFTS`, `Legend Fitness`, `Williams Strength` | Collegiate-grade racks/specialty | S&C/powerlifting (bonus cues, not in core 25 brands) | M |
| `Concept2`, `RowErg`, `SkiErg`, `BikeErg` | `rower_count`, `ski_erg`, `bike_erg` | Conditioning/CrossFit | H |
| `Assault`, `AssaultBike`, `AssaultRunner` | `air_bike`, `curved_treadmill` | HIIT/functional | H |
| `StairMaster`, `Gauntlet`, `StepMill`, `8G`, `10G` | `stepmill_count` ≥ 1 | — | H |
| `Woodway`, `Curve` | Premium/self-powered treads | Athletic/boutique (bonus cue) | M |
| `Keiser`, `M3i`, `Air300`, `Infinity` | Pneumatic machines; M3i fleet ⇒ spin studio | Athletic-perf or active-aging; M3i ⇒ cycle classes | M |
| `EGYM`, `Smart Strength` | `smart_circuit` | Beginner/community (YMCA-class); enthusiast anti-signal | H |
| `Technogym`, `Artis`, `Selection`, `Pure Strength`, `SkillMill`, `Excite` | Full premium floor | Upscale lifestyle club (price-tier proxy) | H |
| `FreeMotion`, `Genesis`, `Dual Cable Cross`, `iFIT` | `functional_trainer`, incline trainers | Big-box functional | H |
| `Matrix Magnum`, `Ultra`, `Versa`, `Aura` | Racks/plate-loaded (Magnum) + selectorized circuit | Mid-premium big-box | M |
| `Cybex`, `Eagle NX`, `Arc Trainer` | Selectorized circuit + arc trainers | Standard big-box | M |
| `Precor`, `EFX`, `AMT`, `Icarian`, `Resolute` | Cardio floor + selectorized | Standard big-box/hotel | M |
| `Life Fitness`, `Insignia`, `Symbio`, `Integrity` | Cardio + selectorized | Standard big-box | M |
| `Hoist`, `ROC-IT` | Rocking selectorized circuit | Mid-market big-box | M |
| `Nautilus`, `Inspiration`, `Impact`, `Leverage` | Selectorized circuit (+ `pullover_machine` historically) | Mid big-box | M |
| `Star Trac`, `FreeRunner` / `TRUE`, `Stryker`, `Alpine Runner` / `Octane`, `Zero Runner`, `LateralX` | Cardio fleet | Neutral; Octane ⇒ low-impact/hospitality | M |
| `WaterRower`, `NOHrD` | Wooden rower | Boutique/hotel aesthetic | M |
| `Titan Fitness`, `REP`, `PR-5000`, `Ares`, `Athena`, `Bells of Steel` | Prosumer racks/cables | Indie/budget strength gym (REP=mid, Titan=budget) | M |
| `Schwinn AC/IC`, `Stages`, `Peloton` (commercial) | Spin bikes | Cycle studio | M |

**Vision pipeline notes:** (1) Plate-loaded and specialty machines have highly distinctive silhouettes — stepmill, arc trainer, GHD, reverse hyper pendulum, hip-thrust wing pads, pendulum squat arc, belt-squat platform hole — train shape-first, logo-second. (2) Logos sit on weight-stack shrouds, seat backs, and frame decals; Hammer Strength/Panatta/Atlantis/Prime wordmarks are large and legible in member photos. (3) Upholstery color is customized per gym — never use color as a brand feature. (4) Selectorized circuits are brand-uniform within a gym: one confident brand ID propagates `plate_loaded_tier`/floor-tier to the whole fleet.

---

## 5. Orchestrator implementation notes
1. **Slugs above are canonical** — alias tables in §2 seed the NLP matcher for review-mining ("they finally got a pendulum squat!!" → `pendulum_squat=true`, source=review, conf=M).
2. **Counts where queues exist** (racks, benches, stepmills, cables, leg presses, smiths); **bools for rare/destination items**; **enum-sets for variant families** (leg curl, calf, specialty bars).
3. Every stored value should carry `{value, source: scrape|vision|review|operator, confidence, last_seen}` — equipment churns; reviews date facts.
4. `plate_loaded_tier` and `machine_coverage_score` are **derived**, recomputed from brand hits + type detections; don't store raw.
5. The 25 stored keys + 6 recovery amenity keys are the entire user-facing filter surface for beta. Everything else lives in a free-text/derived layer.

---

### Sources
- [Life Fitness — Cybex Eagle NX line](https://www.lifefitness.com/en-us/cybex/strength/selectorized/eagle-nx) · [Hammer Strength Iso-Lateral catalog](https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-iso-lateral-row)
- [Peloton/Precor sale status — FitTechGlobal](https://www.fittechglobal.com/fit-tech-news/Precor-to-become-wholly-owned-subsidiary-of-Peloton-as-company-prepares-it-for-sale/350598) · [Peloton completes Precor acquisition](https://www.prnewswire.com/news-releases/peloton-completes-precor-acquisition-301261010.html)
- [TRUE Fitness acquires Octane](https://truefitness.com/true-fitness-technology-inc-acquires-octane-fitness/) · [BowFlex bankruptcy → Johnson Health Tech — Fitt Insider](https://insider.fitt.co/bowflex-files-bankruptcy-sells-assets/)
- [Core Health & Fitness brands](https://corehandf.com/blog/core-brands)
- [PRIME Fitness plate-loaded/Prodigy](https://www.primefitnessusa.com/collections/plate-loaded-equipment) · [Atlantis Strength](https://atlantisstrength.com/gym-equipment/plate-loaded-machines) · [Panatta product lines](https://www.panattasport.com/en/product-lines/) · [gym80 Sygnum](https://gym80.de/en/product-series/weight-stack-en/sygnum-en/) · [Watson plate-loaded](https://watsongym.co.uk/product-category/machines/plate-loaded-machines/) · [Arsenal Strength](https://www.myarsenalstrength.com/strength-equipment)
- [Booty Builder machines](https://bootybuilder.com/product-category/machines/) · [Westside Barbell special devices](https://www.westside-barbell.com/blogs/the-blog/special-devices)
- [Technogym Selection/Pure Strength/Artis/Excite](https://www.technogym.com/en-US/selection-line/) · [Matrix strength lines](https://world.matrixfitness.com/eng/strength) · [Hoist ROC-IT](http://www.hoistfitness.com/commercial/series/rs-roc-it-selectorized)
- [EGYM Smart Strength](https://us.egym.com/en-us/workouts/smartstrength) · [FreeMotion Dual Cable Cross](https://freemotionfitness.com/strength-machine/dual-cable-cross/) · [REP Fitness commercial](https://repfitness.com/pages/commercial-fitness-equipment) · [Kabuki Power relaunch context](https://store.kabukistrength.net/products/power-bar-pre-sale)