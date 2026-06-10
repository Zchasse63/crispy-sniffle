import type { AmenityKey, EquipmentKey, GymSegment } from "@/lib/types/scout";

/** Phrase → key dictionaries for the deterministic fallback parser.
 *  Longest phrase wins; all matching is lowercase substring/phrase based. */

export const AMENITY_SYNONYMS: Record<AmenityKey, string[]> = {
  sauna: ["sauna", "saunas"],
  cold_plunge: ["cold plunge", "cold tub", "ice bath", "plunge pool", "cold-plunge"],
  steam_room: ["steam room", "steamroom"],
  pool: ["pool", "swimming", "lap pool", "swim"],
  recovery_room: ["recovery room", "recovery area", "recovery suite"],
  open_24h: ["24 hour", "24-hour", "24/7", "24 7", "twenty four hour", "open all night", "always open"],
  classes: ["classes", "group classes", "group fitness", "class schedule"],
  personal_training: ["personal training", "personal trainer", "pt sessions", "coaching"],
  turf_area: ["turf", "turf area", "sled track"],
  cardio_zone: ["cardio", "treadmills", "ellipticals", "cardio zone"],
  basketball_court: ["basketball", "hoops", "basketball court"],
  day_pass: ["day pass", "drop in", "drop-in", "daypass", "guest pass"],
  parking: ["parking", "parking lot", "free parking"],
  lockers: ["lockers", "locker room", "locker rooms"],
  showers: ["showers", "shower"],
  towel_service: ["towel service", "towels"],
  wifi: ["wifi", "wi-fi", "wireless"],
  juice_bar: ["juice bar", "smoothie bar", "smoothies", "protein shakes"],
  childcare: ["childcare", "child care", "kids club", "daycare", "babysitting"],
};

export const EQUIPMENT_SYNONYMS: Record<EquipmentKey, string[]> = {
  squat_rack: ["squat rack", "squat racks", "racks", "rack"],
  power_rack: ["power rack", "power cage", "cage"],
  platform: ["platform", "platforms", "lifting platform", "deadlift platform", "olympic platform", "oly platform"],
  dumbbells: ["dumbbell", "dumbbells", "db's", "dbs"],
  barbells: ["barbell", "barbells", "bars"],
  kettlebells: ["kettlebell", "kettlebells", "kb"],
  ghd: ["ghd", "glute ham", "glute-ham", "glute ham developer"],
  sled: ["sled", "prowler", "push sled"],
  ski_erg: ["ski erg", "skierg", "ski-erg"],
  assault_bike: ["assault bike", "air bike", "airbike", "echo bike", "fan bike"],
  rower: ["rower", "rowing machine", "rowers", "erg", "concept 2", "concept2"],
  reverse_hyper: ["reverse hyper", "reverse-hyper", "reverse hyperextension"],
  belt_squat: ["belt squat", "belt-squat"],
  comp_bench: ["competition bench", "comp bench"],
  cable_machine: ["cable machine", "cables", "cable crossover", "functional trainer"],
  leg_press: ["leg press"],
  smith_machine: ["smith machine", "smith"],
  hack_squat: ["hack squat"],
  pull_up_bar: ["pull up bar", "pull-up bar", "pullup bar", "rig"],
  dip_station: ["dip station", "dip bars", "dips"],
  monolift: ["monolift", "mono lift"],
  climbing_wall: ["climbing wall", "bouldering", "rock wall", "rock climbing"],
};

export const SEGMENT_SYNONYMS: Record<GymSegment, string[]> = {
  strength: ["powerlifting", "powerlifter", "strength gym", "strength training", "weightlifting", "olympic lifting", "oly lifting", "bodybuilding", "iron gym", "barbell club", "lifting gym", "serious gym", "hardcore gym"],
  crossfit: ["crossfit", "cross fit", "wod", "functional fitness", "box"],
  big_box: ["big box", "chain gym", "commercial gym", "regular gym"],
  boutique: ["boutique", "studio", "f45", "orangetheory", "otf", "9round", "barry's"],
  climbing: ["climbing", "bouldering", "rock climbing", "climbing gym"],
  yoga_pilates: ["yoga", "pilates", "hot yoga", "vinyasa", "reformer"],
  mma: ["mma", "boxing", "muay thai", "jiu jitsu", "bjj", "kickboxing", "martial arts"],
  recovery: ["recovery", "wellness", "spa", "contrast therapy", "sauna studio"],
};

/** Known equipment brands (matched case-insensitively as whole words/phrases). */
export const KNOWN_BRANDS = [
  "rogue",
  "eleiko",
  "hammer strength",
  "life fitness",
  "technogym",
  "precor",
  "cybex",
  "concept2",
  "concept 2",
  "assault",
  "york",
  "kabuki",
  "titan",
  "matrix",
  "nautilus",
  "arsenal strength",
  "prime",
  "watson",
];

/** Tampa neighborhoods — canonical names must match seed data exactly. */
export const NEIGHBORHOOD_SYNONYMS: Record<string, string[]> = {
  "Downtown": ["downtown"],
  "Channel District": ["channel district", "channelside", "water street"],
  "Hyde Park": ["hyde park", "soho", "howard ave"],
  "South Tampa": ["south tampa", "bayshore", "palma ceia", "ballast point"],
  "Seminole Heights": ["seminole heights"],
  "Ybor City": ["ybor", "ybor city"],
  "Westshore": ["westshore", "west shore", "international plaza"],
  "Carrollwood": ["carrollwood"],
  "North Tampa": ["north tampa", "usf", "university area", "temple terrace"],
};
