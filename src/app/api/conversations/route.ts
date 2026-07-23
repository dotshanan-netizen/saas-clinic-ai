import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/conversations?clinicSlug=rival-clinic
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 1. جلب العيادة المصادق عليها
    const clinic = await prisma.clinic.findUnique({
      where: { id: tenantId },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // إذا تم تحديد مريض معين عبر الجوال، جلب محادثته وتفاصيل حجزه
    const clientPhone = searchParams.get("clientPhone");
    if (clientPhone) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      });

      const booking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        messages: conversation ? conversation.messages : [],
        booking: booking || null,
      });
    }

    // 2. جلب جميع الحجوزات مرتبة بالأحدث — هذه هي القائمة الرئيسية
    const bookings = await prisma.booking.findMany({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: "desc" },
    });

    const result = bookings.map((b) => ({
      id: b.id,
      clientPhone: b.clientPhone,
      clientName: b.clientName,
      serviceName: b.serviceName,
      status: b.status,
      updatedAt: b.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in GET /api/conversations:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/conversations (Send manual WhatsApp message and append to history)
export async function POST(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientPhone, messageText } = body;

    if (!clientPhone || !messageText) {
      return NextResponse.json(
        { error: "Missing clientPhone or messageText" },
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

    // 2. Decrypt WhatsApp token
    const storedToken = clinic.whatsappToken;
    if (!storedToken) {
      return NextResponse.json(
        { error: "WhatsApp credentials not configured for this clinic" },
        { status: 400 }
      );
    }

    const { decrypt } = await import("@/lib/encryption");
    const parts = storedToken.split(":");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Invalid encrypted token format" },
        { status: 500 }
      );
    }
    const [iv, authTag, encryptedData] = parts;
    const decryptedToken = decrypt(encryptedData, iv, authTag);

    // 3. Send message to Meta API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${clinic.whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${decryptedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: clientPhone,
          type: "text",
          text: {
            preview_url: false,
            body: messageText,
          },
        }),
      }
    );

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error("Meta send API error:", errorText);
      return NextResponse.json(
        { error: "Failed to send message via Meta", details: errorText },
        { status: 502 }
      );
    }

    // 4. Log the sent message into the Conversation history in the database
    const conversation = await prisma.conversation.findUnique({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let history: any[] = [];
    if (conversation && conversation.messages) {
      history = conversation.messages as unknown as any[];
    }

    // Add assistant reply to history
    const assistantMsg = {
      role: "assistant",
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    history.push(assistantMsg);

    await prisma.conversation.upsert({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      },
      update: {
        messages: history,
      },
      create: {
        clientPhone: clientPhone,
        clinicId: clinic.id,
        messages: history,
      },
    });

    return NextResponse.json({ success: true, message: assistantMsg });
  } catch (error: unknown) {
    console.error("Error in POST /api/conversations:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
