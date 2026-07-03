import { describe, it, expect, vi } from "vitest";

// auth.ts imports "server-only" (throws outside a react-server condition) and
// the Supabase server helper (pulls in next/headers) at module top level.
// Stub both so the PURE export (hasMinRole) can be imported in the vitest node
// environment. getStaff is never called — no client, no cookies, no network.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(() => {
    throw new Error("getServerClient must not be called from unit tests");
  }),
}));

import { hasMinRole, type StaffRole } from "@/lib/admin/auth";

const LADDER: StaffRole[] = ["viewer", "reviewer", "admin", "owner"]; // ascending

describe("hasMinRole — full role ladder owner > admin > reviewer > viewer", () => {
  it("every role satisfies its own level", () => {
    for (const role of LADDER) {
      expect(hasMinRole(role, role)).toBe(true);
    }
  });

  it("every role satisfies all strictly lower minimums", () => {
    for (let i = 0; i < LADDER.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(hasMinRole(LADDER[i], LADDER[j])).toBe(true);
      }
    }
  });

  it("every role fails all strictly higher minimums", () => {
    for (let i = 0; i < LADDER.length; i++) {
      for (let j = i + 1; j < LADDER.length; j++) {
        expect(hasMinRole(LADDER[i], LADDER[j])).toBe(false);
      }
    }
  });

  it("owner satisfies every minimum (superuser end of the ladder)", () => {
    for (const min of LADDER) {
      expect(hasMinRole("owner", min)).toBe(true);
    }
  });

  it("viewer satisfies only viewer (floor of the ladder)", () => {
    expect(hasMinRole("viewer", "viewer")).toBe(true);
    expect(hasMinRole("viewer", "reviewer")).toBe(false);
    expect(hasMinRole("viewer", "admin")).toBe(false);
    expect(hasMinRole("viewer", "owner")).toBe(false);
  });

  it("admin can act as reviewer and viewer but never as owner", () => {
    expect(hasMinRole("admin", "reviewer")).toBe(true);
    expect(hasMinRole("admin", "viewer")).toBe(true);
    expect(hasMinRole("admin", "owner")).toBe(false);
  });

  it("reviewer can act as viewer but not admin or owner", () => {
    expect(hasMinRole("reviewer", "viewer")).toBe(true);
    expect(hasMinRole("reviewer", "admin")).toBe(false);
    expect(hasMinRole("reviewer", "owner")).toBe(false);
  });
});

describe("hasMinRole — fail-closed on invalid role input", () => {
  // The DB is the source of the role string; if it ever hands back null,
  // undefined, or a value outside the enum, RBAC must deny — never grant.
  const INVALID = [null, undefined, "", "superadmin", "OWNER", "Admin", " viewer"] as const;

  it("a null/absent staff role fails EVERY minimum", () => {
    for (const min of LADDER) {
      expect(hasMinRole(null as unknown as StaffRole, min)).toBe(false);
      expect(hasMinRole(undefined as unknown as StaffRole, min)).toBe(false);
    }
  });

  it("an unrecognized role string fails EVERY minimum (fail-closed)", () => {
    for (const bad of INVALID) {
      for (const min of LADDER) {
        expect(hasMinRole(bad as unknown as StaffRole, min)).toBe(false);
      }
    }
  });

  it("role names are exact-match: casing and whitespace variants are rejected", () => {
    expect(hasMinRole("OWNER" as unknown as StaffRole, "viewer")).toBe(false);
    expect(hasMinRole("Admin" as unknown as StaffRole, "viewer")).toBe(false);
    expect(hasMinRole(" viewer" as unknown as StaffRole, "viewer")).toBe(false);
  });
});
