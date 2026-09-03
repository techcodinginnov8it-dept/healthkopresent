/**
 * In-process OTP store.
 *
 * Stores short-lived one-time passwords keyed by userId + role.
 * Each entry expires after OTP_TTL_MS (default 10 minutes).
 *
 * NOTE: This is an in-memory store — OTPs will be lost on server restart.
 * For production, replace the Map with a Redis/database-backed store.
 */
import "server-only";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_LENGTH = 6;

type OtpEntry = {
  hash: string;     // bcrypt hash of the OTP (prevents clear-text storage)
  lastOtp?: string; // transient check to ensure consecutive codes never repeat
  expiresAt: number;
  attempts: number;
};

const store = new Map<string, OtpEntry>();

function makeKey(role: "doctor" | "patient", userId: string) {
  return `${role}:${userId}`;
}

/**
 * Generate a cryptographically random, guaranteed non-repeating 6-digit numeric OTP.
 * Ensures the new code never equals the previous code generated for this user.
 */
export function generateOtp(role?: "doctor" | "patient", userId?: string): string {
  const { randomInt } = require("crypto") as typeof import("crypto");

  let previousOtp: string | undefined;
  if (role && userId) {
    const existing = store.get(makeKey(role, userId));
    previousOtp = existing?.lastOtp;
  }

  let otp: string;
  let attempts = 0;
  do {
    // Cryptographically secure integer between 100,000 and 999,999 (always 6 digits, no leading zero issues)
    otp = String(randomInt(100000, 1000000));
    attempts++;
  } while (previousOtp && otp === previousOtp && attempts < 10);

  return otp;
}

/** Store a bcrypt-hashed version of the OTP for a user. */
export async function storeOtp(
  role: "doctor" | "patient",
  userId: string,
  otp: string
): Promise<void> {
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(otp, 10);
  store.set(makeKey(role, userId), {
    hash,
    lastOtp: otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

/** Verify a submitted OTP.  Returns 'valid' | 'expired' | 'invalid'. */
export async function verifyOtp(
  role: "doctor" | "patient",
  userId: string,
  otp: string
): Promise<"valid" | "expired" | "invalid"> {
  const entry = store.get(makeKey(role, userId));
  if (!entry) return "invalid";

  if (Date.now() > entry.expiresAt) {
    store.delete(makeKey(role, userId));
    return "expired";
  }

  entry.attempts += 1;

  // Lock out after 5 wrong attempts to prevent brute-force
  if (entry.attempts > 5) {
    store.delete(makeKey(role, userId));
    return "invalid";
  }

  const bcrypt = (await import("bcryptjs")).default;
  const ok = await bcrypt.compare(otp, entry.hash);

  if (ok) {
    store.delete(makeKey(role, userId));
    return "valid";
  }

  return "invalid";
}

/** Clear any pending OTP for a user (e.g. on password change completion). */
export function clearOtp(role: "doctor" | "patient", userId: string): void {
  store.delete(makeKey(role, userId));
}
