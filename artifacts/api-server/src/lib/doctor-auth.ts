import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, doctorAccountsTable, membersTable } from "@workspace/db";

const SESSION_COOKIE = "doctor_session";
const SESSION_SECRET = process.env.DOCTOR_SESSION_SECRET?.trim() || "legacy-bd-ems-doctor-session";

export type DoctorSession = {
  doctorAccountId: number;
  memberId: number;
  username: string;
  callSign: string;
  rank: string;
  name: string;
  issuedAt: number;
};

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export async function hashPassword(input: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(input, salt, 64, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(input: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(input, salt, 64, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) return false;
  return crypto.timingSafeEqual(stored, derived);
}

export function createDoctorSessionCookie(session: Omit<DoctorSession, "issuedAt">): string {
  const payload = JSON.stringify({ ...session, issuedAt: Date.now() });
  const encoded = base64UrlEncode(payload);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function readDoctorSessionCookie(req: Request): DoctorSession | null {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (typeof raw !== "string") return null;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  if (signPayload(encoded) !== signature) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as DoctorSession;
    if (!parsed.doctorAccountId || !parsed.memberId || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shouldUseCrossSiteCookie(req: Request) {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  return req.secure || forwardedProto === "https" || process.env.NODE_ENV === "production";
}

export function writeDoctorSession(req: Request, res: import("express").Response, session: Omit<DoctorSession, "issuedAt">) {
  const crossSite = shouldUseCrossSiteCookie(req);
  res.cookie(SESSION_COOKIE, createDoctorSessionCookie(session), {
    httpOnly: true,
    sameSite: crossSite ? "none" : "lax",
    secure: crossSite,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearDoctorSession(req: Request, res: import("express").Response) {
  const crossSite = shouldUseCrossSiteCookie(req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: crossSite ? "none" : "lax",
    secure: crossSite,
    path: "/",
  });
}

export async function resolveDoctorSession(req: Request): Promise<DoctorSession | null> {
  const session = readDoctorSessionCookie(req);
  if (!session) return null;

  const [doctor] = await db
    .select({
      doctorAccountId: doctorAccountsTable.id,
      memberId: membersTable.id,
      username: doctorAccountsTable.username,
      isActive: doctorAccountsTable.isActive,
      callSign: membersTable.callSign,
      rank: membersTable.rank,
      name: membersTable.name,
    })
    .from(doctorAccountsTable)
    .innerJoin(membersTable, eq(doctorAccountsTable.memberId, membersTable.id))
    .where(and(eq(doctorAccountsTable.id, session.doctorAccountId), eq(doctorAccountsTable.memberId, session.memberId)))
    .limit(1);

  if (!doctor || !doctor.isActive) return null;

  return {
    doctorAccountId: doctor.doctorAccountId,
    memberId: doctor.memberId,
    username: doctor.username,
    callSign: doctor.callSign,
    rank: doctor.rank,
    name: doctor.name,
    issuedAt: session.issuedAt,
  };
}

export const requireDoctorAuth: RequestHandler = async (req, res, next) => {
  try {
    const session = await resolveDoctorSession(req);
    if (!session) {
      return res.status(401).json({ error: "Doctor authentication required" });
    }
    (req as any).doctorSession = session;
    next();
  } catch (error) {
    console.error("[DOCTOR-AUTH] Failed to resolve session:", error);
    return res.status(500).json({ error: "Failed to validate doctor session" });
  }
};
