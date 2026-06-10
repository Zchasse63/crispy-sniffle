/** Load data/community-links.json → community_links (replace-all; links are
 *  curated outbound references only — titles + our neutral notes, no content). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync(resolve(root, "data/community-links.json"), "utf8"));
const rows = data.flatMap((g) =>
  (g.links ?? []).map((l) => ({
    gym_slug: g.slug,
    url: l.url,
    title: String(l.title).slice(0, 200),
    platform: ["reddit", "forum", "blog"].includes(l.platform) ? l.platform : "other",
    year: Number.isInteger(l.year) ? l.year : null,
    topic_note: l.topic_note ? String(l.topic_note).slice(0, 300) : null,
  })),
);
const { error: de } = await db.from("community_links").delete().neq("gym_slug", "");
if (de) throw de;
const { error } = await db.from("community_links").insert(rows);
if (error) throw error;
console.log(`seeded ${rows.length} community links`);
