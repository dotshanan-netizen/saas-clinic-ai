import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Logger } from "@/lib/infrastructure/logging/Logger";

export async function POST(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientPhone, humanTakeover } = body;

    if (!clientPhone || typeof humanTakeover !== "boolean") {
      return NextResponse.json(
        { error: "Missing clientPhone or invalid humanTakeover flag" },
        { status: 400 }
      );
    }

    // 1. Fetch clinic details
    const clinic = await prisma.clinic.findUnique({
      where: { id: tenantId },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // 2. Update conversation
    const conversation = await prisma.conversation.update({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone,
        }
      },
      data: {
        humanTakeover
      }
    });

    Logger.info(`[HumanTakeover] Manually toggled to ${humanTakeover}`, {
      requestId: "manual-takeover",
      clinicId: clinic.id,
      clientPhone
    });

    return NextResponse.json({ success: true, humanTakeover: conversation.humanTakeover });
  } catch (error: unknown) {
    console.error("Error in POST /api/conversations/takeover:", error);
    // If conversation not found, it might be Prisma RecordNotFound error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === "P2025") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
