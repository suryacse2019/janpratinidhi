import { createHmac, timingSafeEqual } from "node:crypto";

type AdminSession = { email: string; exp: number };
const lifetimeSeconds = 8 * 60 * 60;

function signature(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + lifetimeSeconds })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSession(token: string): AdminSession | null {
  try {
    const [payload, providedSignature, extra] = token.split(".");
    if (!payload || !providedSignature || extra) return null;
    const expectedSignature = signature(payload);
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.email || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch { return null; }
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
