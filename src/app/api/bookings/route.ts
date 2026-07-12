import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/bookings?clinicSlug=rival-clinic
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug");

    if (!clinicSlug) {
      return NextResponse.json(
        { error: "Missing clinicSlug query parameter" },
        { status: 400 }
      );
    }

    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error: unknown) {
    console.error("Error in GET /api/bookings:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/bookings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, bookingId, status, clientName, clientPhone, serviceName, doctorName, branchName, timeSlot, source, clinicSlug } = body;

    // Action 1: Update status of an existing booking
    if (action === "updateStatus") {
      if (!bookingId || !status) {
        return NextResponse.json(
          { error: "Missing required fields: bookingId, status" },
          { status: 400 }
        );
      }

      // ADR-006: State Transition Guard
      // Allowed transitions:
      //   PENDING   → CONFIRMED
      //   PENDING   → CANCELLED
      //   CONFIRMED → COMPLETED
      //   CONFIRMED → CANCELLED
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        PENDING:   ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      // Fetch current booking to know current state
      const currentBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!currentBooking) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const currentStatus = currentBooking.status;
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];

      if (!allowedNext.includes(status)) {
        // ADR-005: Business Logic owns the final response for forbidden decisions
        console.log(`Forbidden transition blocked: ${currentStatus} → ${status} (booking: ${bookingId})`);
        return NextResponse.json(
          {
            error: "Forbidden transition",
            message: `لا يمكن تغيير حالة الحجز من "${currentStatus}" إلى "${status}".`,
            currentStatus,
            requestedStatus: status,
            allowedTransitions: allowedNext,
          },
          { status: 400 }
        );
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
      });

      return NextResponse.json({ success: true, booking: updatedBooking });
    }

    // Action 2: Create a new booking manually from the Dashboard
    if (action === "create") {
      if (!clinicSlug || !clientName || !clientPhone || !serviceName || !doctorName || !branchName || !timeSlot) {
        return NextResponse.json(
          { error: "Missing required fields for creation" },
          { status: 400 }
        );
      }

      const clinic = await prisma.clinic.findUnique({
        where: { slug: clinicSlug },
      });

      if (!clinic) {
        return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
      }

      const newBooking = await prisma.booking.create({
        data: {
          clientName,
          clientPhone,
          serviceName,
          doctorName,
          branchName,
          timeSlot,
          source: source || "Dashboard",
          status: "PENDING",
          clinicId: clinic.id,
        },
      });

      return NextResponse.json({ success: true, booking: newBooking });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error in POST /api/bookings:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
