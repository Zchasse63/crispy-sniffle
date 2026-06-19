import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A URL-safe invite token (raw — shown to the operator once, never stored). */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** sha256 hex of a token — only the hash is stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
