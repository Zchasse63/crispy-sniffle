# Scout load tests (k6)

Read-path load tests for the Scout site. **Read-only by design** — they hit only
public, cacheable/RSC read surfaces. They deliberately do **not** touch:

- `POST /api/owner/*` or `/admin/*` — writes; invite/burst-gated; would mutate the catalog.
- the `ai-search` edge function — **each call costs Anthropic tokens** and is rate-limited
  20/min/IP. Never throughput-test it here.
- auth / magic-link — sends real email, rate-limited.

## Safety rules (read before running against prod)

1. **Prod is a live beta on a single Supabase project.** Run against prod only
   **off-hours**, and start at a **low arrival rate** (`RATE=5`), raising it a step at
   a time while you watch the Supabase dashboard (connections, CPU) — abort if it climbs.
2. The connection pool (Supavisor, transaction mode) is the real ceiling. If you see
   pool exhaustion or 5xx, you've found the limit — back off.
3. To test *capacity* rather than the intentional per-IP limits, run distributed
   (multiple source IPs) or against a Supabase branch sized like prod.

## Install

    brew install k6        # or: https://grafana.com/docs/k6/latest/set-up/install-k6/

## Run

    # quick sanity (1 VU, each key page once, asserts 200 + latency)
    k6 run loadtest/read-smoke.js

    # ramping read mix (defaults: 5 rps for 2m). Override via env:
    BASE_URL=https://scout-gym.netlify.app RATE=5 DURATION=2m k6 run loadtest/read-ramp.js

    # against a preview/branch deploy instead of prod:
    BASE_URL=https://<deploy-preview>.netlify.app RATE=25 DURATION=3m k6 run loadtest/read-ramp.js

Both scripts pull the **live gym slugs from `/sitemap.xml`** at setup, so they always
exercise real detail pages without a hardcoded list.

## What to watch while it runs

- **k6 output:** `http_req_duration` p95/p99, `http_req_failed` rate, per-page tags.
- **Supabase → Reports/Database:** active connections, CPU, and `pg_stat_statements`
  for any query that climbs under load.
- **Netlify → Functions:** SSR function duration, cold-start rate, error rate.

Thresholds are encoded in each script (`options.thresholds`); a run **fails** if p95 or
the error rate blow past them — that's your pass/fail gate.
