# Scout Launch Checklist — the 5 dashboard minutes only a human can do

Everything code-side is shipped. These items live in third-party dashboards
(no API path with our current credentials) and gate real-user sign-ins.

## 1. Supabase Auth — redirect URLs *(sign-in 403s in production without this)*
Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://scout-gym.netlify.app`
- **Redirect URLs:** add BOTH
  - `https://scout-gym.netlify.app/auth/callback`
  - `http://localhost:3100/auth/callback`

## 2. Supabase Auth — custom SMTP via Resend *(built-in SMTP ≈ 2–4 emails/hour; two users break it)*
Dashboard → Authentication → Emails → SMTP Settings → Enable custom SMTP:
- **Host:** `smtp.resend.com` · **Port:** `465`
- **Username:** `resend`
- **Password:** the `RESEND_API_KEY` (already in `.env.local` + Supabase Vault)
- **Sender email:** `onboarding@resend.dev` · **Sender name:** `Scout`

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
