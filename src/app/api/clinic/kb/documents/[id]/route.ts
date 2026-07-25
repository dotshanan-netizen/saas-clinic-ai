import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { id } = await params;

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });

    if (!document || document.clinicId !== tenantId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/kb/documents/[id] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { id } = await params;

    const document = await prisma.knowledgeDocument.findUnique({ where: { id } });

    if (!document || document.clinicId !== tenantId) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 403 });
    }

    // This will cascade and delete all KnowledgeChunk entries related to this document
    await prisma.knowledgeDocument.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/kb/documents/[id] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
