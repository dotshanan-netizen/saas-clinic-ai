import { jwtVerify, SignJWT, JWTPayload } from "jose";
import { cookies } from "next/headers";


function getSecretKey() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is missing");
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function encrypt(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecretKey());
}

export async function decrypt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
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
  } catch {
    return null;
  }
}


