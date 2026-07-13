import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processChatMessage } from "@/lib/chat-processor";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, clientPhone, clinicSlug, source = "Simulator", action } = body;

    if (!clientPhone || !clinicSlug) {
      return NextResponse.json(
        { error: "Missing required fields: clientPhone, clinicSlug" },
        { status: 400 }
      );
    }

    // 1. Fetch the clinic with all catalog data
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
      include: {
        branches: { where: { status: "ACTIVE" } },
        doctors: { where: { status: "ACTIVE" } },
        services: { where: { status: "ACTIVE" } },
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // Handle Reset Action
    if (action === "reset") {
      await prisma.conversation.deleteMany({
        where: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      });
      return NextResponse.json({ success: true, message: "Conversation reset successfully" });
    }

    if (!message || message.trim() === "") {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 450 });
    }

    // 2. Call the shared message processor
    const result = await processChatMessage(clinic, clientPhone, message, source);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in /api/chat:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

