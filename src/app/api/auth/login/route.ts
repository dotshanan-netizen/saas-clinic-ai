import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

// TEMPORARY DEVELOPMENT LOGIN ENDPOINT
export async function POST(req: NextRequest) {
  try {
    const { clinicSlug } = await req.json();

    if (!clinicSlug) {
      return NextResponse.json({ error: "Missing clinicSlug" }, { status: 400 });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug }
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const payload = { clinicId: clinic.id, role: "admin", slug: clinic.slug };
    const sessionToken = await encrypt(payload);

    const cookieStore = await cookies();
    cookieStore.set("clinova_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return NextResponse.json({ success: true, message: "Logged in successfully" });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
