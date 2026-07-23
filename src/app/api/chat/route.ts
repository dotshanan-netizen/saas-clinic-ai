import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ConversationEngine } from "@/lib/domain/ConversationEngine";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestId = crypto.randomUUID();
    const body = await request.json();
    const { message, clientPhone, source = "Simulator", action } = body;

    if (!clientPhone) {
      return NextResponse.json(
        { error: "Missing required field: clientPhone" },
        { status: 400 }
      );
    }

    // 1. Fetch the clinic with all catalog data scoped to logged in tenant
    const clinic = await prisma.clinic.findUnique({
      where: { id: tenantId },
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
    const result = await ConversationEngine.processMessage(clinic, clientPhone, message, source, requestId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in /api/chat:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

