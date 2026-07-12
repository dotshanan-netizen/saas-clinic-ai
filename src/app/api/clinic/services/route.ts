import { NextRequest, NextResponse } from "next/server";
import { PrismaServiceRepository } from "@/repositories/prisma/PrismaServiceRepository";
import { PrismaDoctorRepository } from "@/repositories/prisma/PrismaDoctorRepository";
import { CatalogService } from "@/services/CatalogService";
import { UpsertServiceSchema } from "@/dtos";

const serviceRepository = new PrismaServiceRepository();
const doctorRepository = new PrismaDoctorRepository();
const catalogService = new CatalogService(serviceRepository, doctorRepository);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicSlug = searchParams.get("clinicSlug");

    if (!clinicSlug) {
      return NextResponse.json({ error: "Required parameter 'clinicSlug' is missing" }, { status: 400 });
    }

    const services = await catalogService.getServices(clinicSlug);
    return NextResponse.json(services);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/services error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = UpsertServiceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    const service = await catalogService.upsertService(result.data);
    return NextResponse.json(service);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/services error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json({ error: "Required parameter 'serviceId' is missing" }, { status: 400 });
    }

    const deleted = await catalogService.deleteService(serviceId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/services error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
