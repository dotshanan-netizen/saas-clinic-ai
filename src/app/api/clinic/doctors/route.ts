import { NextRequest, NextResponse } from "next/server";
import { PrismaServiceRepository } from "@/repositories/prisma/PrismaServiceRepository";
import { PrismaDoctorRepository } from "@/repositories/prisma/PrismaDoctorRepository";
import { CatalogService } from "@/services/CatalogService";
import { UpsertDoctorSchema } from "@/dtos";
import { prisma } from "@/lib/db";

const serviceRepository = new PrismaServiceRepository();
const doctorRepository = new PrismaDoctorRepository();
const catalogService = new CatalogService(serviceRepository, doctorRepository);

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const doctors = await catalogService.getDoctors(clinic.slug);
    return NextResponse.json(doctors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/doctors error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const body = await req.json();
    body.clinicSlug = clinic.slug; // Force the DTO to use authenticated clinicSlug

    const result = UpsertDoctorSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    if (result.data.id) {
      const existing = await prisma.doctor.findUnique({ where: { id: result.data.id } });
      if (!existing || existing.clinicId !== tenantId) {
        return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
      }
    }

    const doctor = await catalogService.upsertDoctor(result.data);
    return NextResponse.json(doctor);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/doctors error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");

    if (!doctorId) {
      return NextResponse.json({ error: "Required parameter 'doctorId' is missing" }, { status: 400 });
    }

    const existing = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!existing || existing.clinicId !== tenantId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    const deleted = await catalogService.deleteDoctor(doctorId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/doctors error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
