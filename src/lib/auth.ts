import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "molkky_session";
const MAX_AGE = 60 * 60 * 12; // 12h

export type Role = "admin" | "judge";
export type Session = { role: Role; name?: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role | undefined;
    if (role !== "admin" && role !== "judge") return null;
    return { role, name: payload.name as string | undefined };
  } catch {
    return null;
  }
}

export async function setSession(session: Session) {
  const token = await new SignJWT({ role: session.role, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export function checkAdminPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && pw === expected;
}

export function checkJudgePassword(pw: string) {
  const expected = process.env.JUDGE_PASSWORD;
  return !!expected && pw === expected;
}

export async function isAdmin() {
  return (await getSession())?.role === "admin";
}

export async function getJudge(): Promise<Session | null> {
  // Admins can also act as judges.
  const s = await getSession();
  return s ?? null;
}
