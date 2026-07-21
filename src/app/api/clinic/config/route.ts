import { NextRequest, NextResponse } from "next/server";
import { PrismaClinicRepository } from "@/repositories/prisma/PrismaClinicRepository";
import { ClinicService } from "@/services/ClinicService";
import { UpdateClinicConfigSchema } from "@/dtos";

const clinicRepository = new PrismaClinicRepository();
const clinicService = new ClinicService(clinicRepository);

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await clinicService.getClinicProfileById(tenantId);
    return NextResponse.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/config error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = UpdateClinicConfigSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clinicSlug, ...dto } = result.data;
    const updatedProfile = await clinicService.updateClinicConfigById(tenantId, {
      clinicSlug,
      ...dto,
    });

    return NextResponse.json(updatedProfile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/config error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
