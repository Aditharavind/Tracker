/**
 * Shared secret hashing for user PINs.
 *
 * Deliberately byte-compatible with the Python original
 * (`hashlib.pbkdf2_hmac("sha256", secret, salt, 100_000)` stored as
 * `salt_hex:digest_hex`), so a database written by the FastAPI version still
 * verifies here and vice versa.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LEN = 32; // sha256 digest size, matching pbkdf2_hmac's default dklen
const DIGEST = "sha256";

export function hashSecret(secret) {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(secret, salt, ITERATIONS, KEY_LEN, DIGEST);
  return `${salt.toString("hex")}:${digest.toString("hex")}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== "string") return false;
  const [saltHex, digestHex] = stored.split(":", 2);
  if (!saltHex || !digestHex) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(digestHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;

  const actual = pbkdf2Sync(secret, salt, ITERATIONS, KEY_LEN, DIGEST);
  return timingSafeEqual(actual, expected);
}

/** URL-safe, ~12 chars, matching Python's secrets.token_urlsafe(9). */
export function newShareToken() {
  return randomBytes(9).toString("base64url");
}
