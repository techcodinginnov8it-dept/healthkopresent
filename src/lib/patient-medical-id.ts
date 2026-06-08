import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export type PatientMedicalIdTokenPayload = {
  patientId: string;
  profileVersion: string;
};

function getMedicalIdSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  // Fallback — tokens signed with this will never match a real token,
  // so parsePatientMedicalIdToken returns null → clean 404 instead of 500.
  return "healthko-fallback-unsigned";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return createHmac("sha256", getMedicalIdSecret()).update(value).digest("base64url");
}

export function createPatientMedicalIdToken(payload: PatientMedicalIdTokenPayload) {
  const serialized = toBase64Url(JSON.stringify(payload));
  const signature = signValue(serialized);
  return `${serialized}.${signature}`;
}

export function parsePatientMedicalIdToken(token: string): PatientMedicalIdTokenPayload | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signValue(payload);

  try {
    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const parsed = JSON.parse(fromBase64Url(payload)) as PatientMedicalIdTokenPayload;

    if (
      !parsed ||
      typeof parsed.patientId !== "string" ||
      typeof parsed.profileVersion !== "string" ||
      !parsed.patientId ||
      !parsed.profileVersion
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildPatientMedicalIdUrl(origin: string, token: string) {
  return new URL(`/medical-id/${encodeURIComponent(token)}`, origin).toString();
}
