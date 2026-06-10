/** Beta blog: editorial grounded in Scout's own verified dataset.
 *  Plain data module (no CMS/MDX dep) — posts are arrays of blocks. */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  blocks: Array<
    | { t: "p"; text: string }
    | { t: "h2"; text: string }
    | { t: "ul"; items: string[] }
  >;
}

export const POSTS: BlogPost[] = [
  {
    slug: "why-gym-fit-matters",
    title: "Why finding a gym that fits you matters more than finding a “good” gym",
    description:
      "Star ratings can't tell you whether the dumbbells stop at 50 lbs or whether the sauna actually exists. Fit can.",
    date: "2026-06-10",
    blocks: [
      {
        t: "p",
        text: "Every gym in Tampa has a 4-point-something rating somewhere. That number tells you almost nothing, because the things that make a gym right for YOU are specific: whether the racks are free at 6 AM, whether the dumbbells go past 100 lbs, whether there's childcare on a Tuesday, whether you can walk in with a day pass or need to book a class first.",
      },
      {
        t: "p",
        text: "Scout's whole design comes from one rule we learned mapping Tampa: labels are vibes, equipment is ground truth. A beautiful wellness studio with a sauna and cold plunge is a wonderful place — and a terrible answer to “where can I lift heavy?” So when you search, training intents always check the actual equipment list, and atmosphere words (“vibey”, “old school”) only ever boost — they never hide a gym that has what you need.",
      },
      { t: "h2", text: "What fit actually looks like" },
      {
        t: "ul",
        items: [
          "A powerlifter's fit: 8 squat racks, dumbbells to 200 lbs, a competition bench rated to 1,100 lbs — that's Powerhouse Athletic Club, and you can test it for a $20 day pass.",
          "A recovery fit: a 14-person Nordic sauna at 195–205°F with guided cold plunges at 42–55°F — Kodawari's contrast sessions, $22 to try.",
          "A logistics fit: free garage parking, classes you can book tonight, and a free first class — half of South Tampa's studios qualify.",
        ],
      },
      {
        t: "p",
        text: "Every fact on Scout carries its source — gym-published, web data, community-confirmed, or honestly labeled as estimated. When we don't know, we say “unlisted.” That's the difference between a directory and a recommendation you can act on.",
      },
    ],
  },
  {
    slug: "tampa-serious-lifting-gyms",
    title: "Tampa's serious lifting gyms, ranked by what's actually on the floor",
    description:
      "Racks, bars, and dumbbell runs — the verified equipment data behind Tampa's strength scene.",
    date: "2026-06-10",
    blocks: [
      {
        t: "p",
        text: "“Serious lifting gym” gets thrown around loosely. We define it by the floor: rack count, barbell quality, dumbbell ceiling, and the specialty pieces that signal a gym expects you to train hard.",
      },
      { t: "h2", text: "The standouts, from their own published specs" },
      {
        t: "ul",
        items: [
          "Powerhouse Gym Athletic Club (Carrollwood) — urethane dumbbells to 200 lbs, a Rogue Ohio bar among 10,000+ lbs of plates, Olympic platforms, a reverse hyper, and an Elite Fitness competition bench rated to 1,100 lbs. Day pass $20.",
          "813 Barbell (Seminole Heights) — strength-first programming under USAPL-certified coaching, 24/7 member access, day pass $20, week pass $45.",
          "Powerhouse Gym North Tampa — 11,000 sq ft of bodybuilding-era iron since 1983: dumbbells 5–150 lbs, deadlift platforms, no frills. Day pass $15.",
          "EoS Fitness Tampa Midtown — big-box pricing ($9.99/mo tier) with dumbbells confirmed to 150 lbs and lifting platforms; the budget pick that still lifts.",
        ],
      },
      {
        t: "p",
        text: "Worth knowing: machine-level depth is where gyms differentiate next — hip thrust stations, pendulum squats, proper leg-curl variety. We've started tracking those keys gym-by-gym (look for the “Pro preview” badge on equipment lists).",
      },
    ],
  },
  {
    slug: "day-pass-vs-membership-math",
    title: "Day pass or membership? The break-even math for Tampa gyms",
    description:
      "Real prices, simple arithmetic: when passes win, when joining wins, and the visit counts where it flips.",
    date: "2026-06-10",
    blocks: [
      {
        t: "p",
        text: "Day passes are the best product in fitness for people who hate commitment — and a quiet money-loser past a certain visit count. The flip point is just monthly price divided by pass price, rounded up.",
      },
      { t: "h2", text: "Real Tampa break-evens" },
      {
        t: "ul",
        items: [
          "Powerhouse Athletic Club: $20 passes vs $32.99/mo (2-year rate) — joining wins from your 2nd visit each month.",
          "Bella Prana Yoga: $25 drop-ins vs $125/mo unlimited — the flip is visit 5; under once-a-week, keep dropping in.",
          "Kodawari: $22 contrast sessions vs memberships from $72/mo — visit 4 flips it.",
          "Bayshore Fit: $30 day pass vs $149/mo — visit 5 (and the day pass excludes the infrared sauna; members get it all).",
          "MADabolic Ybor: $35 drop-ins vs $188 per 28 days — visit 6.",
        ],
      },
      {
        t: "p",
        text: "Scout shows this math on every gym page that publishes both prices — and if you log your visits in your profile, we'll tell you the month your own habits cross the line. Honest math, even when it costs a gym a pass sale: that's the point.",
      },
    ],
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug) ?? null;
