import { NextResponse } from "next/server";
import { BookingService } from "@/lib/domain/BookingService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorName = searchParams.get("doctorName");
    const clinicSlug = searchParams.get("clinicSlug");

    if (!doctorName || !clinicSlug) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Normally we should look up clinicId by slug, for now we assume we have a helper or we just do it here:
    const { prisma } = await import("@/lib/db");
    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

    const availableSlots = await BookingService.getAvailableSlots(clinic.id, doctorName);

    return NextResponse.json({ availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
