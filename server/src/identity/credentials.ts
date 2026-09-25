import { createHash, randomBytes } from "node:crypto";

const PREFIX = "mbr_";

/** A new, random run credential value. Only its hash is stored (CONTRACT-002 ID9). */
export function generateCredential(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function hashCredential(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** A well-formed credential: the prefix followed by 43 base64url characters. */
export function isWellFormedCredential(value: string): boolean {
  return /^mbr_[A-Za-z0-9_-]{43}$/.test(value);
}
