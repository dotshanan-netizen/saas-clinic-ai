import { NextRequest, NextResponse } from "next/server";
import { PrismaClinicRepository } from "@/repositories/prisma/PrismaClinicRepository";
import { ClinicService } from "@/services/ClinicService";
import { UpdateClinicConfigSchema } from "@/dtos";

const clinicRepository = new PrismaClinicRepository();
const clinicService = new ClinicService(clinicRepository);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicSlug = searchParams.get("clinicSlug");

    if (!clinicSlug) {
      return NextResponse.json({ error: "Required parameter 'clinicSlug' is missing" }, { status: 400 });
    }

    const profile = await clinicService.getClinicProfile(clinicSlug);
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

    const { clinicSlug, ...dto } = result.data;
    const updatedProfile = await clinicService.updateClinicConfig(clinicSlug, {
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
