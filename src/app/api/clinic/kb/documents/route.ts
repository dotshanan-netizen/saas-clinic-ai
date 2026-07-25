import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const documents = await prisma.knowledgeDocument.findMany({
      where: { clinicId: tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        language: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json(documents);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/kb/documents error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
