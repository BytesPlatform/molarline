/**
 * Encryption for integration tokens at rest. AES-256-GCM with a key from
 * SECRET_STORE_KEY, so a database dump alone never yields a credential.
 * The ciphertext carries a version tag, the IV and the auth tag, and any
 * tampering fails the decrypt loudly.
 *
 * Shared across the three products.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.SECRET_STORE_KEY || "dev-only-secret-store-key";
  return createHash("sha256").update(secret).digest();
}

export function secretStoreConfigured(): boolean {
  return Boolean(process.env.SECRET_STORE_KEY);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

export function decryptSecret(boxed: string): string {
  if (!boxed.startsWith("v1:")) throw new Error("not a sealed secret");
  const raw = Buffer.from(boxed.slice(3), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
