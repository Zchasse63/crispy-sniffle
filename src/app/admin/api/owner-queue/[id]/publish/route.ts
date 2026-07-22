import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit, logGymEdits, type GymEditEntry } from "@/lib/admin/api";
import { DISCOUNT_COLUMNS, isOnOffValue, type OnOffValue, type ParsedFact } from "@/lib/owner/parse";
import type { PlanDraft } from "@/lib/owner/answerTypes";
import { AMENITY_LABELS, EQUIPMENT_LABELS, VIBE_TAGS, type MembershipPlan } from "@/lib/types/scout";
import { isOwnerPhotoUrl } from "@/lib/owner/photoUrl";
import type { Database } from "@/lib/types/database";

const OWNER_CONF = 0.95;
const VALID_AMENITIES = new Set(Object.keys(AMENITY_LABELS));
const VALID_EQUIPMENT = new Set(Object.keys(EQUIPMENT_LABELS));
const VALID_VIBES = new Set<string>(VIBE_TAGS);

/** Map a free-text owner photo tag to the constrained gym_photos.subject enum. */
function photoSubject(tag: string | null | undefined): string {
  const t = (tag ?? "").toLowerCase();
  if (/floor|gym|workout|training/.test(t)) return "gym_floor";
  if (/rack|weight|equip|machine|cardio|dumbbell|barbell/.test(t)) return "equipment";
  if (/exterior|outside|front|entrance|building|sign/.test(t)) return "exterior";
  if (/park/.test(t)) return "parking";
  if (/lounge|cafe|caf|lobby|desk|reception/.test(t)) return "lounge_cafe";
  if (/sauna|recovery|cold|plunge|locker|shower|spa/.test(t)) return "sauna_recovery";
  return "other";
}

/** The 3 commitment columns the plan-draft UI edits; every other term (e.g.
 *  paid_in_full, 3_month) rides through untouched via `carry`. */
const DRAFT_TERMS = new Set(["month_to_month", "6_month", "12_month"]);

/** Reassemble catalog plans from drafts + the carried original plan, so fields
 *  the 3-column UI doesn't edit (scope/hours/includes/notes/paid_total/extra
 *  terms) survive a round trip instead of being destroyed. Owner-created plans
 *  have no carry and publish exactly what was typed. */
function planDraftsToPlans(drafts: PlanDraft[]): MembershipPlan[] {
  return drafts
    .filter((p) => p.name.trim())
    .map((p) => {
      const carry = p.carry;
      const edited = p.prices
        .filter((pr) => pr.monthly !== null && DRAFT_TERMS.has(pr.term))
        .map((pr) => {
          const carried = carry?.prices?.find((c) => c.term === pr.term);
          // Restore paid_total only when the monthly is unchanged — a changed
          // price makes the old paid_total stale (never fabricate a mismatch).
          return carried?.paid_total != null && carried.monthly === pr.monthly
            ? { term: pr.term, monthly: pr.monthly, paid_total: carried.paid_total }
            : { term: pr.term, monthly: pr.monthly };
        });
      const carriedExtra = (carry?.prices ?? []).filter((c) => !DRAFT_TERMS.has(c.term));
      const plan: MembershipPlan = {
        name: p.name.trim(),
        usage: p.usageType ? { type: p.usageType, count: p.usageCount ?? null } : null,
        prices: [...edited, ...carriedExtra],
      };
      if (carry) {
        if (carry.scope !== undefined) plan.scope = carry.scope;
        if (carry.hours !== undefined) plan.hours = carry.hours;
        if (carry.includes !== undefined) plan.includes = carry.includes;
        if (carry.notes !== undefined) plan.notes = carry.notes;
      }
      return plan;
    });
}

/** Legacy pending facts (pre-{on,off} deploy) carried a plain selected array;
 *  treat them as attest-only (nothing deselected → nothing written false). */
function toOnOff(v: unknown): OnOffValue {
  if (Array.isArray(v)) return { on: v as string[], off: [] };
  if (isOnOffValue(v)) return v;
  return { on: [], off: [] };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("reviewer");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { decisions?: Record<string, "publish" | "reject">; reviewNote?: string };
  try {
    body = await req.json();
  } catch {
    // Fail CLOSED: an unreadable body must not fall through to "publish every
    // fact" via the per-fact default decision.
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decisions = body.decisions ?? {};

  const { data: sub, error: subErr } = await service
    .from("owner_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (sub.status !== "pending" && sub.status !== "needs_info") {
    return NextResponse.json({ error: `Already ${sub.status}` }, { status: 409 });
  }

  // Atomically CLAIM this submission before writing anything to the catalog.
  // Two reviewers opening the same submission would both pass the read-check
  // above and both write; this conditional update flips it out of the reviewable
  // states in ONE statement, so exactly one wins (rows=1) and the other gets
  // rows=0 → 409 and never touches the catalog.
  const originalStatus = sub.status;
  const { data: claim, error: claimErr } = await service
    .from("owner_submissions")
    .update({
      status: "published",
      reviewed_by: staff.userId,
      reviewed_at: new Date().toISOString(),
      review_note: body.reviewNote?.trim() || null,
    })
    .eq("id", id)
    .in("status", ["pending", "needs_info"])
    .select("id")
    .maybeSingle();
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claim) {
    return NextResponse.json(
      { error: "Submission was just claimed by another reviewer — reload the queue." },
      { status: 409 },
    );
  }
  // If a catalog write fails after the claim, reset the submission to its
  // reviewable state so it can be retried rather than left marked "published"
  // with an incomplete catalog write.
  const failPublish = async (message: string) => {
    await service
      .from("owner_submissions")
      .update({ status: originalStatus, reviewed_by: null, reviewed_at: null, review_note: null })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  };

  const facts = (sub.parsed_facts as unknown as ParsedFact[]) ?? [];
  const gymId = sub.gym_id;

  const gymPatch: Record<string, unknown> = {};
  const amenityUpserts: { gym_id: string; amenity_key: string; present: boolean; source: string; confidence: number }[] = [];
  // equipment ops keyed by equipment_key: ensure present (from an accepted
  // equipmentSet) and/or set attrs. attr-only keys never CREATE a new row.
  const equipOps = new Map<string, { quantity?: number; max_weight_lbs?: number; ensurePresent?: boolean }>();
  // owner-attested removals → row DELETE (gym_equipment has no present column;
  // row existence IS presence).
  const equipDeletes = new Set<string>();
  const photoInserts: { gym_id: string; url: string; subject: string | null; source: string }[] = [];
  let parkingOp: { kind: string | null; access: string | null; fee_detail: string | null } | null = null;
  const factLog: Database["public"]["Tables"]["owner_fact_log"]["Insert"][] = [];
  const gymEdits: GymEditEntry[] = [];

  let publishedCount = 0;
  let rejectedCount = 0;
  let skippedCount = 0;

  for (const fact of facts) {
    const decision = decisions[fact.key] ?? "publish"; // default: accept
    if (decision === "reject") {
      rejectedCount++;
      factLog.push({
        submission_id: id,
        gym_id: gymId,
        field: fact.key,
        old_value: fact.oldValue as never,
        new_value: fact.newValue as never,
        decision: "rejected",
        actor: staff.userId,
      });
      continue;
    }

    const t = fact.target;
    switch (t.type) {
      case "scalar":
      case "bool":
        // Reject implausible numeric values (negative or non-finite) rather than
        // writing them into price/count columns — the answer map is client-controlled.
        if (typeof fact.newValue === "number" && (!Number.isFinite(fact.newValue) || fact.newValue < 0)) {
          skippedCount++;
          factLog.push({
            submission_id: id,
            gym_id: gymId,
            field: fact.key,
            old_value: fact.oldValue as never,
            new_value: fact.newValue as never,
            decision: "skipped",
            actor: staff.userId,
          });
          continue;
        }
        gymPatch[t.column] = fact.newValue;
        break;
      case "discounts": {
        // {on, off}: on → true, off → false; every OTHER column is OMITTED so
        // a key the owner never mentioned is never written (never-fabricate).
        const { on, off } = toOnOff(fact.newValue);
        for (const k of on) {
          const col = DISCOUNT_COLUMNS[k];
          if (col) gymPatch[col] = true;
        }
        for (const k of off) {
          const col = DISCOUNT_COLUMNS[k];
          if (col) gymPatch[col] = false;
        }
        break;
      }
      case "commitment": {
        const { on, off } = toOnOff(fact.newValue);
        // no_contract_option only when month_to_month was explicitly on/off.
        if (on.includes("month_to_month")) gymPatch.no_contract_option = true;
        else if (off.includes("month_to_month")) gymPatch.no_contract_option = false;
        // min_commitment_months only when a months-term was explicitly on, or
        // every selected months-term was removed (→ null). Unmentioned → omit.
        const monthsOf = (terms: string[]) =>
          terms.includes("12_month") ? 12 : terms.includes("6_month") ? 6 : terms.includes("3_month") ? 3 : null;
        const onMonths = monthsOf(on);
        if (onMonths !== null) gymPatch.min_commitment_months = onMonths;
        else if (monthsOf(off) !== null) gymPatch.min_commitment_months = null;
        break;
      }
      case "amenitySet":
        for (const k of fact.newValue as string[]) {
          if (VALID_AMENITIES.has(k)) {
            amenityUpserts.push({ gym_id: gymId, amenity_key: k, present: true, source: "owner", confidence: OWNER_CONF });
          }
        }
        break;
      case "amenityRemove":
        // present:false at the owner tier is a first-class render state
        // ("owner says no sauna") — NOT a row delete.
        for (const k of fact.newValue as string[]) {
          if (VALID_AMENITIES.has(k)) {
            amenityUpserts.push({ gym_id: gymId, amenity_key: k, present: false, source: "owner", confidence: OWNER_CONF });
          }
        }
        break;
      case "equipmentSet":
        for (const k of fact.newValue as string[]) {
          if (VALID_EQUIPMENT.has(k)) equipOps.set(k, { ...(equipOps.get(k) ?? {}), ensurePresent: true });
        }
        break;
      case "equipmentRemove":
        for (const k of fact.newValue as string[]) {
          if (VALID_EQUIPMENT.has(k)) equipDeletes.add(k);
        }
        break;
      case "equipmentAttr": {
        if (!VALID_EQUIPMENT.has(t.equipmentKey)) {
          // Unknown equipment key — record as skipped rather than pretend it published.
          skippedCount++;
          factLog.push({
            submission_id: id,
            gym_id: gymId,
            field: fact.key,
            old_value: fact.oldValue as never,
            new_value: fact.newValue as never,
            decision: "skipped",
            actor: staff.userId,
          });
          continue;
        }
        if (t.attr === "quantity" && fact.newValue === 0) {
          // "Zero racks" asserts ABSENCE. gym_equipment has no present column —
          // row existence IS presence — so a 0 must DELETE the row, not leave a
          // present row at quantity 0 (which scoring AND the detail page still
          // read as "has it"). equipDeletes is reconciled below and survives
          // unless an ensurePresent op for the same key cancels it, which a bare
          // 0 never sets; a nonexistent row simply deletes nothing (no fabrication).
          equipDeletes.add(t.equipmentKey);
        } else {
          const cur = equipOps.get(t.equipmentKey) ?? {};
          cur[t.attr] = fact.newValue as number;
          // An owner-attested count / measurement implies the equipment is present,
          // so ensure the row exists — otherwise the attribute is silently dropped.
          cur.ensurePresent = true;
          equipOps.set(t.equipmentKey, cur);
        }
        break;
      }
      case "hours":
        // open_24h is preserved from the existing gym row after this loop.
        gymPatch.hours = { ...(fact.newValue as Record<string, unknown>) };
        break;
      case "plans":
        gymPatch.membership_plans = planDraftsToPlans(fact.newValue as PlanDraft[]);
        break;
      case "vibes":
        // Whitelist against the vibe taxonomy (like amenities/equipment) — an
        // owner submission is client-controlled, so never write arbitrary
        // non-taxonomy strings into gyms.vibe_tags (no DB CHECK constrains it).
        gymPatch.vibe_tags = (fact.newValue as string[]).filter((v) => VALID_VIBES.has(v));
        gymPatch.vibe_source = "owner";
        break;
      case "photos":
        // Defense-in-depth: only re-publish OUR storage URLs, even if an older
        // quarantined submission carried a tampered url in parsed_facts.
        for (const ph of fact.newValue as { url: string; tag?: string | null }[]) {
          if (ph?.url && isOwnerPhotoUrl(ph.url)) {
            photoInserts.push({ gym_id: gymId, url: ph.url, subject: photoSubject(ph.tag), source: "owner" });
          }
        }
        break;
      case "parking":
        parkingOp = fact.newValue as { kind: string | null; access: string | null; fee_detail: string | null };
        break;
      case "earlyTermination":
        gymPatch.early_termination = fact.newValue;
        break;
      case "brands":
        // Informational: the owner's brand list is surfaced in the queue + logged,
        // but brand→equipment mapping is ambiguous, so it's applied by hand in the
        // inspector rather than mechanically. No catalog write — record as skipped
        // (not "published") so the fact log stays honest.
        skippedCount++;
        factLog.push({
          submission_id: id,
          gym_id: gymId,
          field: fact.key,
          old_value: fact.oldValue as never,
          new_value: fact.newValue as never,
          decision: "skipped",
          actor: staff.userId,
        });
        continue;
      case "info":
        // Owner-provided context we don't model as a catalog column (positioning,
        // demographics, counts, contact phone). Logged + shown in the queue, never
        // written to the catalog — a human reads it. Not counted as published.
        skippedCount++;
        factLog.push({
          submission_id: id,
          gym_id: gymId,
          field: fact.key,
          old_value: fact.oldValue as never,
          new_value: fact.newValue as never,
          decision: "skipped",
          actor: staff.userId,
        });
        continue;
    }

    publishedCount++;
    factLog.push({
      submission_id: id,
      gym_id: gymId,
      field: fact.key,
      old_value: fact.oldValue as never,
      new_value: fact.newValue as never,
      decision: "published",
      actor: staff.userId,
    });
    gymEdits.push({
      gym_id: gymId,
      actor: staff.userId,
      action: "owner_publish",
      field: fact.key,
      old_value: fact.oldValue,
      new_value: fact.newValue,
      source: "owner",
      confidence: OWNER_CONF,
    });
  }

  // Owner-submitted hours are AUTHORITATIVE. The owner hours grid strips
  // open_24h from input, so a submitted day-schedule means staffed hours — i.e.
  // NOT open 24h. The old code copied a stale open_24h flag forward, which is
  // exactly why an owner correcting a false "Open 24h" claim couldn't clear it.
  // Clear the flag, and also flip any lingering open_24h amenity to present=false
  // (owner-sourced) so the tri-state can't still read 24h from that row.
  if ("hours" in gymPatch) {
    (gymPatch.hours as Record<string, unknown>).open_24h = false;
    amenityUpserts.push({
      gym_id: gymId,
      amenity_key: "open_24h",
      present: false,
      source: "owner",
      confidence: OWNER_CONF,
    });
  }

  // Grant the Owner-Listed badge + write the gym row only when a fact actually
  // changes the catalog. A publish of only informational facts (e.g. brands) or
  // a fee-only parking note with no kind/access earns no badge.
  const parkingHasEffect = !!parkingOp && (!!parkingOp.kind || !!parkingOp.access);
  const hasCatalogChange =
    Object.keys(gymPatch).length > 0 ||
    amenityUpserts.length > 0 ||
    equipOps.size > 0 ||
    equipDeletes.size > 0 ||
    photoInserts.length > 0 ||
    parkingHasEffect;
  if (hasCatalogChange) {
    // Scalar provenance: only when this publish actually wrote gym-row content
    // (hours/prices/description/etc.), not amenity/equipment/photo-only publishes.
    const wroteGymScalars = Object.keys(gymPatch).length > 0;
    gymPatch.owner_listed = true;
    const now = new Date().toISOString();
    gymPatch.updated_at = now;
    // Explicit re-verification stamps — set ONLY when this publish actually
    // wrote that field (never backfilled), so the freshness UI never claims
    // a verification that didn't happen.
    if ("hours" in gymPatch) gymPatch.hours_verified_at = now;
    if ("day_pass_price" in gymPatch) gymPatch.day_pass_verified_at = now;
    if (wroteGymScalars) gymPatch.data_source = "owner";
    const { error: gymErr } = await service
      .from("gyms")
      .update(gymPatch as Database["public"]["Tables"]["gyms"]["Update"])
      .eq("id", gymId);
    if (gymErr) return await failPublish(`gym update: ${gymErr.message}`);
  }

  // Amenities (PK gym_id,amenity_key → upsert).
  if (amenityUpserts.length > 0) {
    const { error } = await service
      .from("gym_amenities")
      .upsert(amenityUpserts as never, { onConflict: "gym_id,amenity_key" });
    if (error) return await failPublish(`amenities: ${error.message}`);
  }

  // Equipment removals — DELETE the rows (row existence IS presence on
  // gym_equipment; old values are preserved in the fact/gym-edit logs above).
  // A presence assertion (ensurePresent) wins over a removal, but a quantity-0
  // attribute op is itself an absence signal and must NOT cancel the delete.
  for (const [k, op] of equipOps) if (op.ensurePresent) equipDeletes.delete(k);
  if (equipDeletes.size > 0) {
    const { error } = await service
      .from("gym_equipment")
      .delete()
      .eq("gym_id", gymId)
      .in("equipment_key", [...equipDeletes] as never);
    if (error) return await failPublish(`equipment delete: ${error.message}`);
  }

  // Equipment (no natural unique key → find-or-insert per key).
  if (equipOps.size > 0) {
    const keys = [...equipOps.keys()];
    const { data: existing, error: exErr } = await service
      .from("gym_equipment")
      .select("id, equipment_key, quantity, max_weight_lbs")
      .eq("gym_id", gymId)
      .in("equipment_key", keys as never);
    if (exErr) return await failPublish(`equipment read: ${exErr.message}`);
    const byKey = new Map((existing ?? []).map((r) => [r.equipment_key, r]));
    for (const [key, attrs] of equipOps) {
      const row = byKey.get(key as never);
      if (row) {
        const patch: Record<string, unknown> = { source: "owner", confidence: OWNER_CONF };
        if (attrs.quantity !== undefined) patch.quantity = attrs.quantity;
        if (attrs.max_weight_lbs !== undefined) patch.max_weight_lbs = attrs.max_weight_lbs;
        const { error } = await service.from("gym_equipment").update(patch as never).eq("id", row.id);
        if (error) return await failPublish(`equipment update: ${error.message}`);
      } else if (attrs.ensurePresent) {
        // Create the row when an equipmentSet fact added the key, or when an
        // owner-attested attribute (count / max weight) implies the equipment is
        // present. Owner-sourced, so this is attestation — not fabrication.
        const { error } = await service.from("gym_equipment").insert({
          gym_id: gymId,
          equipment_key: key as never,
          source: "owner",
          confidence: OWNER_CONF,
          quantity: attrs.quantity ?? null,
          max_weight_lbs: attrs.max_weight_lbs ?? null,
        } as never);
        if (error) return await failPublish(`equipment insert: ${error.message}`);
      }
    }
  }

  // Photos → gym gallery (additive).
  if (photoInserts.length > 0) {
    const { error } = await service.from("gym_photos").insert(photoInserts as never);
    if (error) return await failPublish(`photos: ${error.message}`);
  }

  // Parking (primary spot) → find-or-insert the gym_parking primary row.
  if (parkingOp) {
    const patch: Record<string, unknown> = { source: "owner", confidence: OWNER_CONF };
    if (parkingOp.kind) patch.kind = parkingOp.kind;
    if (parkingOp.access) patch.access = parkingOp.access;
    if (parkingOp.fee_detail) patch.fee_detail = parkingOp.fee_detail;
    const { data: primary } = await service
      .from("gym_parking")
      .select("id")
      .eq("gym_id", gymId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (primary) {
      const { error } = await service.from("gym_parking").update(patch as never).eq("id", primary.id);
      if (error) return await failPublish(`parking update: ${error.message}`);
    } else if (parkingOp.kind) {
      // kind is NOT NULL — only create a row when the owner gave a parking kind.
      const { error } = await service.from("gym_parking").insert({
        gym_id: gymId,
        kind: parkingOp.kind,
        access: parkingOp.access ?? "unknown",
        fee_detail: parkingOp.fee_detail,
        is_primary: true,
        source: "owner",
        confidence: OWNER_CONF,
      } as never);
      if (error) return await failPublish(`parking insert: ${error.message}`);
    }
  }

  // Status was already set to 'published' by the atomic claim at the top; every
  // catalog write succeeded (a failure would have reset the claim and returned).
  // Write the logs recording what was published.
  if (factLog.length > 0) {
    const { error } = await service.from("owner_fact_log").insert(factLog);
    if (error) console.error("[owner_fact_log] insert failed:", error.message);
  }
  await logGymEdits(service, gymEdits);
  await logAudit(service, staff.userId, "owner_submission.publish", "owner_submissions", id, {
    gym_id: gymId,
    published: publishedCount,
    rejected: rejectedCount,
    skipped: skippedCount,
  });

  return NextResponse.json({ ok: true, published: publishedCount, rejected: rejectedCount, skipped: skippedCount });
}
