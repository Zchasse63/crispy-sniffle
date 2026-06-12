/** Enable Google/Apple SSO on Supabase Auth via the Management API.
 *  Prereq: create the OAuth apps first (steps in docs/launch-checklist.md),
 *  then put creds in .env.local and run:  node scripts/enable-oauth.mjs
 *
 *  NOTE: api.supabase.com blocks python-urllib UAs (Cloudflare 1010);
 *  Node fetch + curl are fine. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.local");
const REF = "hblldqsccjpiikbhyknd";

const body = {};
if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_SECRET) {
  body.external_google_enabled = true;
  body.external_google_client_id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  body.external_google_secret = process.env.GOOGLE_OAUTH_SECRET;
}
if (process.env.APPLE_OAUTH_CLIENT_ID && process.env.APPLE_OAUTH_SECRET) {
  body.external_apple_enabled = true;
  body.external_apple_client_id = process.env.APPLE_OAUTH_CLIENT_ID; // Services ID
  body.external_apple_secret = process.env.APPLE_OAUTH_SECRET; // generated JWT
}
if (Object.keys(body).length === 0) {
  console.log("No OAuth creds in .env.local yet — nothing to enable.");
  console.log("Needed: GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_SECRET and/or APPLE_OAUTH_CLIENT_ID + APPLE_OAUTH_SECRET.");
  process.exit(0);
}
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`PATCH ${res.status}: ${(await res.text()).slice(0, 200)}`);
const cfg = await res.json();
console.log("google enabled:", cfg.external_google_enabled, "| apple enabled:", cfg.external_apple_enabled);
console.log('Now set NEXT_PUBLIC_OAUTH_PROVIDERS="google,apple" (or subset) in Netlify env + .env.local and redeploy.');
