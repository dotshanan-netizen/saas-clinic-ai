import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = new TextEncoder().encode(
  process.env.ENCRYPTION_KEY || "fallback_secret_key_change_me_in_prod"
);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET_KEY);
}

export async function decrypt(token: string): Promise<any> {
  const { payload } = await jwtVerify(token, SECRET_KEY, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("clinova_session")?.value;
  if (!sessionToken) return null;
  
  try {
    return await decrypt(sessionToken);
  } catch (err) {
    return null;
  }
}

export function hashPassword(password: string): string {
  const crypto = require("crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const crypto = require("crypto");
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}
