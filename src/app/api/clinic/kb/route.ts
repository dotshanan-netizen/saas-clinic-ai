import { NextRequest, NextResponse } from "next/server";
import { PrismaKnowledgeBaseRepository } from "@/repositories/prisma/PrismaKnowledgeBaseRepository";
import { KnowledgeBaseService } from "@/services/KnowledgeBaseService";
import { UpsertKbSchema } from "@/dtos";
import { prisma } from "@/lib/db";

const kbRepository = new PrismaKnowledgeBaseRepository();
const kbService = new KnowledgeBaseService(kbRepository);

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const kbItems = await kbService.getKBItems(clinic.slug);
    return NextResponse.json(kbItems);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/kb error:", err);
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

    const result = UpsertKbSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    if (result.data.id) {
      const existing = await prisma.knowledgeBase.findUnique({ where: { id: result.data.id } });
      if (!existing || existing.clinicId !== tenantId) {
        return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
      }
    }

    const kbItem = await kbService.upsertKBItem(result.data);
    return NextResponse.json(kbItem);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/kb error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "Required parameter 'kbId' is missing" }, { status: 400 });
    }

    const existing = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!existing || existing.clinicId !== tenantId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    const deleted = await kbService.deleteKBItem(kbId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/kb error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
