import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/bookings
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: tenantId },
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
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, bookingId, status, clientName, clientPhone, serviceName, doctorName, branchName, timeSlot, source } = body;

    const ownerClinic = await prisma.clinic.findUnique({
      where: { id: tenantId },
    });

    if (!ownerClinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

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

      // Fetch booking scoped to the authenticated clinic (clinicId guard)
      const currentBooking = await prisma.booking.findFirst({
        where: { id: bookingId, clinicId: ownerClinic.id },
      });

      if (!currentBooking) {
        return NextResponse.json(
          { error: "Booking not found or does not belong to this clinic" },
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

      // Safe: update is scoped to verified booking and checks current status to prevent race conditions
      const updateResult = await prisma.booking.updateMany({
        where: { id: bookingId, status: currentStatus },
        data: { status },
      });

      if (updateResult.count === 0) {
        return NextResponse.json(
          { error: "Conflict", message: "تغيرت حالة الحجز بالفعل من قبل مستخدم آخر. يرجى التحديث." },
          { status: 409 }
        );
      }

      // Fetch the final updated record to return
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      return NextResponse.json({ success: true, booking: updatedBooking });
    }

    // Action 2: Create a new booking manually from the Dashboard
    if (action === "create") {
      if (!clientName || !clientPhone || !serviceName || !doctorName || !branchName || !timeSlot) {
        return NextResponse.json(
          { error: "Missing required fields for creation" },
          { status: 400 }
        );
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
          clinicId: ownerClinic.id,
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
