# Scout Launch Checklist

## 1. ✅ DONE 2026-06-10 — Supabase Auth redirect URLs
Configured via Management API (PAT in `.env.local` as `SUPABASE_ACCESS_TOKEN`)
and verified by readback: Site URL `https://scout-gym.netlify.app`; allow-list
carries the production callback + localhost 3100/3000.

## 2. ✅ DONE 2026-06-10 — custom SMTP via Resend
Configured via Management API, verified by readback: `smtp.resend.com:465`,
user `resend`, sender `Scout <onboarding@resend.dev>`, auth email rate limit
raised 2/hr → 30/hr.

> **Test-key constraints (current key):** Resend test keys deliver ONLY to the
> Resend account owner's email, from `onboarding@resend.dev`. Perfect for the
> sign-in round-trip test below; before public beta, verify a domain in Resend
> (e.g. `scoutgym.app` when purchased), swap the sender, and rotate to a
> production key (insert into Vault under the same name — newest wins).

## 3. The round-trip test *(proves auth end-to-end)*
1. Visit https://scout-gym.netlify.app → Sign in → your (Resend account) email.
2. Click the magic link → should land on `/me` signed in.
3. Reload the tab and revisit after >1 hour: still signed in?
   - If sessions drop on the deployed site: this Next version's production
     build emits no middleware bundle (root `proxy.ts` runs in dev only —
     verified during R8). Fix is pinning `next` to the latest stable and
     re-testing; tracked in PLAN.md.
4. Tap "I trained here" on a gym → appears in /me visit log.

## 4. Later (not launch-gating)
- Rotate ALL chat-shared keys: Supabase service-role, Anthropic (Vault),
  Mapbox pk/sk, Netlify token, Resend.
- Resend domain verification → production key → alert-sender edge function.
- Optional analytics account (Plausible/PostHog) — our own `search_logs`
  telemetry is already capturing queries either way.
- Call 9Round Henderson Blvd re: possible closure (listing currently
  de-emphasized pending verification).
