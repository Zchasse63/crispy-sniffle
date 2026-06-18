# Auth write-loop — verified runbook (the moat path)

**Status: PROVEN end-to-end against the live DB on 2026-06-18** (the audit's
#1 risk — "built but never run with a real user" — is now closed for the core
community/auth surface).

## What was proven

A real authenticated session (the project's first) drove the full community
write path through the actual UI, and every write was confirmed in the
database under the real user's id, then cleaned up:

| Step | UI action | DB effect (verified) |
|---|---|---|
| Sign in | modal → Password tab → email+password → submit | session established; `/me` renders authed shell |
| Log visit | gym page → "I trained here" | `gym_visits` +1; shows in `/me` visit log |
| Confirm fact | equipment row → confirm (✓) | `fact_confirmations` +1, verdict `confirm` |
| Post review | community → 5★ + comment → Post | `gym_reviews` +1 (rating 5); renders publicly |
| (denorm) | — | `refresh_gym_rating` RPC → gym `rating`/`rating_count` updated, **`rating_is_seed` flipped to false** |
| Training prefs | `/me` → segment + vibe → Save | `profiles.training_prefs` = `{segments:[strength],vibes:[hardcore]}` |

RLS held throughout: authenticated owner reads its own visits/prefs; public
reads the visible review. The H1 error-state fixes were exercised (no false
"Saved"/"Logged"). After verification, all rows were deleted and the target
gym's rating reset to its true unrated/seed state — **no production
pollution remains**.

## Seeded test account

A confirmed user exists for repeat runs (created via the GoTrue admin API):
`scout-qa@example.com`. Credentials live in `.env.local` as
`SCOUT_E2E_EMAIL` / `SCOUT_E2E_PASSWORD` / `SCOUT_E2E_GYM_SLUG` (gitignored).

## Automated, self-cleaning coverage

`tests/e2e/signed-in/moat-loop.spec.ts` encodes this loop. It is **opt-in** —
it `test.skip`s unless the `SCOUT_E2E_*` env vars are present, so normal CI
never writes to prod. When run with creds it signs in for real, logs a visit,
posts a review, asserts each persists, and **self-cleans in `afterAll`** via
the service role (deletes the account's rows + resets the gym rating)
regardless of pass/fail.

Run it deliberately with:

```sh
npx playwright test tests/e2e/signed-in
```

## Still owned by the human

- The **magic-link** round-trip (real inbox) — the password path is proven;
  the OTP/email path still needs one real-inbox click (Resend test key
  delivers only to the account owner).
- **SSO** (Google/Apple) — scaffolded, awaits console creds
  (`docs/launch-checklist.md` §3).
