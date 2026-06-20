import { PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Icon Lab · Scout Admin" };

const INK = "1c2b36";
const iconUrl = (icon: string, emoji = false) =>
  `https://api.iconify.design/${icon}.svg?height=30${emoji ? "" : `&color=%23${INK}`}`;

const TYPES = [
  "Strength",
  "CrossFit",
  "Big Box",
  "Boutique",
  "Climbing",
  "Yoga",
  "MMA",
  "Recovery",
  "Luxury",
  "Cycling",
  "Barre",
] as const;

type Lib = { name: string; note: string; emoji?: boolean; icons: Record<string, string> };

const LINE: Lib[] = [
  {
    name: "Lucide — current",
    note: "what we ship today",
    icons: {
      Strength: "lucide:dumbbell",
      CrossFit: "lucide:flame",
      "Big Box": "lucide:building-2",
      Boutique: "lucide:sparkles",
      Climbing: "lucide:mountain",
      Yoga: "lucide:flower-2",
      MMA: "lucide:swords",
      Recovery: "lucide:snowflake",
      Luxury: "lucide:crown",
      Cycling: "lucide:bike",
      Barre: "lucide:person-standing",
    },
  },
  {
    name: "Material Symbols — outlined",
    note: "your pick so far",
    icons: {
      Strength: "material-symbols-light:fitness-center",
      CrossFit: "material-symbols-light:sprint",
      "Big Box": "material-symbols-light:warehouse-outline",
      Boutique: "material-symbols-light:storefront-outline",
      Climbing: "material-symbols-light:landscape-outline",
      Yoga: "material-symbols-light:self-improvement",
      MMA: "material-symbols-light:sports-martial-arts",
      Recovery: "material-symbols-light:spa-outline",
      Luxury: "material-symbols-light:workspace-premium-outline",
      Cycling: "material-symbols-light:directions-bike",
      Barre: "material-symbols-light:sports-gymnastics",
    },
  },
  {
    name: "Material Symbols — filled",
    note: "same vocab, more character",
    icons: {
      Strength: "material-symbols:fitness-center",
      CrossFit: "material-symbols:sprint",
      "Big Box": "material-symbols:warehouse",
      Boutique: "material-symbols:storefront",
      Climbing: "material-symbols:landscape",
      Yoga: "material-symbols:self-improvement",
      MMA: "material-symbols:sports-martial-arts",
      Recovery: "material-symbols:spa",
      Luxury: "material-symbols:workspace-premium",
      Cycling: "material-symbols:directions-bike",
      Barre: "material-symbols:sports-gymnastics",
    },
  },
  {
    name: "Phosphor — regular",
    note: "friendly, 6 weights",
    icons: {
      Strength: "ph:barbell",
      CrossFit: "ph:lightning",
      "Big Box": "ph:buildings",
      Boutique: "ph:diamond",
      Climbing: "ph:mountains",
      Yoga: "ph:flower-lotus",
      MMA: "ph:boxing-glove",
      Recovery: "ph:drop",
      Luxury: "ph:crown",
      Cycling: "ph:bicycle",
      Barre: "ph:sneaker-move",
    },
  },
  {
    name: "Phosphor — thin",
    note: "lighter, refined",
    icons: {
      Strength: "ph:barbell-thin",
      CrossFit: "ph:lightning-thin",
      "Big Box": "ph:buildings-thin",
      Boutique: "ph:diamond-thin",
      Climbing: "ph:mountains-thin",
      Yoga: "ph:flower-lotus-thin",
      MMA: "ph:boxing-glove-thin",
      Recovery: "ph:drop-thin",
      Luxury: "ph:crown-thin",
      Cycling: "ph:bicycle-thin",
      Barre: "ph:sneaker-move-thin",
    },
  },
  {
    name: "Hugeicons",
    note: "large modern set",
    icons: {
      Strength: "hugeicons:dumbbell-01",
      CrossFit: "hugeicons:workout-run",
      "Big Box": "hugeicons:store-01",
      Boutique: "hugeicons:diamond",
      Climbing: "hugeicons:mountain",
      Yoga: "hugeicons:yoga-01",
      MMA: "hugeicons:boxing-glove",
      Recovery: "hugeicons:swimming",
      Luxury: "hugeicons:crown",
      Cycling: "hugeicons:bicycle-01",
      Barre: "hugeicons:gymnastic",
    },
  },
  {
    name: "Tabler",
    note: "clean, geometric",
    icons: {
      Strength: "tabler:barbell",
      CrossFit: "tabler:bolt",
      "Big Box": "tabler:building",
      Boutique: "tabler:diamond",
      Climbing: "tabler:mountain",
      Yoga: "tabler:yoga",
      MMA: "tabler:karate",
      Recovery: "tabler:droplet",
      Luxury: "tabler:crown",
      Cycling: "tabler:bike",
      Barre: "tabler:stretching",
    },
  },
];

const EMOJI: Lib[] = [
  {
    name: "Twemoji",
    note: "shipped emoji — identical everywhere",
    emoji: true,
    icons: {
      Strength: "twemoji:person-lifting-weights",
      CrossFit: "twemoji:person-running",
      "Big Box": "twemoji:office-building",
      Boutique: "twemoji:shopping-bags",
      Climbing: "twemoji:person-climbing",
      Yoga: "twemoji:person-in-lotus-position",
      MMA: "twemoji:boxing-glove",
      Recovery: "twemoji:droplet",
      Luxury: "twemoji:crown",
      Cycling: "twemoji:person-biking",
      Barre: "twemoji:ballet-shoes",
    },
  },
  {
    name: "Fluent Emoji — flat",
    note: "modern flat emoji",
    emoji: true,
    icons: {
      Strength: "fluent-emoji-flat:person-lifting-weights",
      CrossFit: "fluent-emoji-flat:person-running",
      "Big Box": "fluent-emoji-flat:office-building",
      Boutique: "fluent-emoji-flat:shopping-bags",
      Climbing: "fluent-emoji-flat:person-climbing",
      Yoga: "fluent-emoji-flat:person-in-lotus-position",
      MMA: "fluent-emoji-flat:boxing-glove",
      Recovery: "fluent-emoji-flat:droplet",
      Luxury: "fluent-emoji-flat:crown",
      Cycling: "fluent-emoji-flat:person-biking",
      Barre: "fluent-emoji-flat:ballet-shoes",
    },
  },
  {
    name: "OpenMoji",
    note: "open-source, line-art emoji",
    emoji: true,
    icons: {
      Strength: "openmoji:person-lifting-weights",
      CrossFit: "openmoji:person-running",
      "Big Box": "openmoji:office-building",
      Boutique: "openmoji:shopping-bags",
      Climbing: "openmoji:person-climbing",
      Yoga: "openmoji:person-in-lotus-position",
      MMA: "openmoji:boxing-glove",
      Recovery: "openmoji:droplet",
      Luxury: "openmoji:crown",
      Cycling: "openmoji:person-biking",
      Barre: "openmoji:ballet-shoes",
    },
  },
];

// Proposed Twemoji glyph per type (the working decision).
const PROPOSED: Record<string, string> = {
  Strength: "twemoji:flexed-biceps",
  CrossFit: "twemoji:person-lifting-weights",
  "Big Box": "twemoji:department-store",
  Boutique: "twemoji:sparkles",
  Climbing: "twemoji:person-climbing",
  Yoga: "twemoji:person-in-lotus-position",
  MMA: "twemoji:boxing-glove",
  Recovery: "twemoji:hot-springs",
  Luxury: "twemoji:crown",
  Cycling: "twemoji:person-biking",
  Barre: "twemoji:ballet-shoes",
};

// Contested types — alternatives to weigh (first = current pick).
const ALTS: { type: string; options: { icon: string; label: string }[] }[] = [
  {
    type: "Strength",
    options: [
      { icon: "twemoji:flexed-biceps", label: "muscle · pick" },
      { icon: "twemoji:person-lifting-weights", label: "lifter" },
    ],
  },
  {
    type: "Big Box",
    options: [
      { icon: "twemoji:department-store", label: "store · pick" },
      { icon: "twemoji:office-building", label: "building" },
    ],
  },
  {
    type: "Boutique",
    options: [
      { icon: "twemoji:sparkles", label: "sparkles · pick" },
      { icon: "twemoji:gem-stone", label: "gem" },
      { icon: "twemoji:shopping-bags", label: "bags" },
    ],
  },
  {
    type: "MMA",
    options: [
      { icon: "twemoji:boxing-glove", label: "glove · pick" },
      { icon: "twemoji:martial-arts-uniform", label: "gi" },
    ],
  },
  {
    type: "Recovery",
    options: [
      { icon: "twemoji:hot-springs", label: "sauna · pick" },
      { icon: "twemoji:ice", label: "plunge" },
      { icon: "twemoji:droplet", label: "water" },
    ],
  },
  {
    type: "Cycling",
    options: [
      { icon: "twemoji:person-biking", label: "rider · pick" },
      { icon: "twemoji:bicycle", label: "bike" },
    ],
  },
];

function ProposedRow() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-5">
      {TYPES.map((t) => (
        <div key={t} className="flex w-20 flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl(PROPOSED[t], true)} alt={t} width={40} height={40} />
          <span className="mt-2 text-center text-xs font-medium text-ink">{t}</span>
        </div>
      ))}
    </div>
  );
}

function AltsBlock() {
  return (
    <div className="flex flex-col gap-4">
      {ALTS.map((row) => (
        <div key={row.type} className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 text-sm font-medium text-ink">{row.type}</span>
          {row.options.map((o) => (
            <div key={o.icon} className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl(o.icon, true)} alt={o.label} width={32} height={32} />
              <span className="mt-1 text-[10px] text-mist">{o.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LibRow({ lib }: { lib: Lib }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <span className="text-sm font-semibold text-ink">{lib.name}</span>
        <span className="text-xs text-mist">{lib.note}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {TYPES.map((t) => (
          <div key={t} className="flex w-16 flex-col items-center">
            <div className="flex h-9 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl(lib.icons[t], lib.emoji)} alt={t} width={30} height={30} />
            </div>
            <span className="mt-1.5 text-center text-[11px] leading-tight text-mist">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IconLabPage() {
  return (
    <>
      <PageHeader
        title="Icon Lab"
        description="Gym-type icon options across libraries. Internal reference — pick a set for the segment icons."
      />
      <Panel title="Proposed Twemoji set (working decision)" className="mb-5 p-4">
        <ProposedRow />
      </Panel>
      <Panel title="Contested types — alternatives to weigh" className="mb-5 p-4">
        <AltsBlock />
      </Panel>
      <Panel title="Line icon sets" className="mb-5 p-4">
        {LINE.map((lib) => (
          <LibRow key={lib.name} lib={lib} />
        ))}
      </Panel>
      <Panel title="Emoji sets (shipped SVG — consistent across devices)" className="p-4">
        {EMOJI.map((lib) => (
          <LibRow key={lib.name} lib={lib} />
        ))}
      </Panel>
    </>
  );
}
