// One-off: set a known password on the staff account for portal/Playwright testing.
// Usage: node scripts/set-staff-password.mjs <email> <password>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error("usage: node scripts/set-staff-password.mjs <email> <password>");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) throw error;
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error("no auth user with email", email);
  process.exit(1);
}

const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
if (upErr) throw upErr;
console.log("password set for", email, "(id", user.id + ")");
