// Quick read-path sanity: hit each key page once, assert 200 + a latency bar.
// Not a load test — a fast "is the site healthy and reasonably fast" check.
//   k6 run loadtest/read-smoke.js
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "https://scout-gym.netlify.app";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  // Grab a real gym slug from the sitemap so the detail-page check is live.
  const sm = http.get(`${BASE}/sitemap.xml`);
  const m = sm.body ? String(sm.body).match(/\/gym\/([a-z0-9-]+)</) : null;
  const slug = m ? m[1] : "bayshore-fit";

  const pages = [
    { name: "home", url: `${BASE}/` },
    { name: "gym_detail", url: `${BASE}/gym/${slug}` },
    { name: "compare", url: `${BASE}/compare` },
    { name: "trips", url: `${BASE}/trips` },
  ];

  for (const p of pages) {
    const res = http.get(p.url, { tags: { name: p.name } });
    check(res, {
      [`${p.name} 200`]: (r) => r.status === 200,
      [`${p.name} has html`]: (r) => String(r.body).includes("<html") || String(r.body).includes("<!DOCTYPE"),
    });
  }
}
