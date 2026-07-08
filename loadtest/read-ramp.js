// Ramping read-mix load test for Scout's public read surfaces.
// READ-ONLY: gym detail (70%), discovery home (20%), compare (10%).
// Never hits /api/owner, /admin, ai-search, or auth (see loadtest/README.md).
//
//   BASE_URL=https://scout-gym.netlify.app RATE=5 DURATION=2m k6 run loadtest/read-ramp.js
//
// Defaults are intentionally conservative. Raise RATE one step at a time and only
// off-hours when pointing at prod — watch the Supabase connection count.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "https://scout-gym.netlify.app";
const RATE = Number(__ENV.RATE || 5); // steady-state requests/sec
const DURATION = __ENV.DURATION || "2m";

const errorRate = new Rate("scout_errors");
const gymDetail = new Trend("scout_gym_detail_ms", true);

export const options = {
  scenarios: {
    read_mix: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: RATE, duration: "30s" }, // warm up TO the target rate
        { target: RATE, duration: DURATION }, // hold steady at RATE
        { target: 0, duration: "20s" }, // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% non-2xx/3xx
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    scout_errors: ["rate<0.01"],
    "http_req_duration{name:gym_detail}": ["p(95)<900"],
  },
};

export function setup() {
  const res = http.get(`${BASE}/sitemap.xml`);
  const slugs = res.body
    ? [...String(res.body).matchAll(/\/gym\/([a-z0-9-]+)</g)].map((m) => m[1])
    : [];
  return { slugs: slugs.length ? slugs : ["bayshore-fit"] };
}

export default function (data) {
  const r = Math.random();
  let url, name;
  if (r < 0.7) {
    const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)];
    url = `${BASE}/gym/${slug}`;
    name = "gym_detail";
  } else if (r < 0.9) {
    url = `${BASE}/`;
    name = "home";
  } else {
    url = `${BASE}/compare`;
    name = "compare";
  }
  const res = http.get(url, { tags: { name } });
  const ok = check(res, { "status is 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  if (name === "gym_detail") gymDetail.add(res.timings.duration);
  sleep(0.2);
}
