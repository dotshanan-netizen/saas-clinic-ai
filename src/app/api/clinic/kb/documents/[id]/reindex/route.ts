import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueDocumentProcessing } from "@/lib/infrastructure/queue/DocumentProcessorQueue";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "kb");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { id } = await params;

    const document = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!document || document.clinicId !== tenantId) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file for re-indexing" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileExt = path.extname(file.name) || ".tmp";
    const tempFileName = `${randomUUID()}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, tempFileName);

    await fs.writeFile(filePath, buffer);

    // Update version and status
    await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        status: "PROCESSING",
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    await enqueueDocumentProcessing({
      documentId: id,
      filePath,
      mimeType: file.type
    });

    return NextResponse.json({ 
      success: true, 
      documentId: id, 
      status: "PROCESSING" 
    }, { status: 202 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/kb/documents/[id]/reindex error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
