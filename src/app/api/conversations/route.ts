import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/conversations?clinicSlug=rival-clinic
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug") || "rival-clinic"; // افتراضي للتسهيل في المتصفح

    // 1. جلب العيادة
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
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
