import { NextRequest, NextResponse } from "next/server";
import { PrismaKnowledgeBaseRepository } from "@/repositories/prisma/PrismaKnowledgeBaseRepository";
import { KnowledgeBaseService } from "@/services/KnowledgeBaseService";
import { UpsertKbSchema } from "@/dtos";

const kbRepository = new PrismaKnowledgeBaseRepository();
const kbService = new KnowledgeBaseService(kbRepository);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicSlug = searchParams.get("clinicSlug");

    if (!clinicSlug) {
      return NextResponse.json({ error: "Required parameter 'clinicSlug' is missing" }, { status: 400 });
    }

    const kbItems = await kbService.getKBItems(clinicSlug);
    return NextResponse.json(kbItems);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/kb error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = UpsertKbSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
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
    const { searchParams } = new URL(req.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "Required parameter 'kbId' is missing" }, { status: 400 });
    }

    const deleted = await kbService.deleteKBItem(kbId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/kb error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
