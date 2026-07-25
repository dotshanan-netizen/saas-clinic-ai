import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueDocumentProcessing } from "@/lib/infrastructure/queue/DocumentProcessorQueue";
import fs from "fs/promises";
import path from "path";
import { KbCategory } from "@/generated/prisma";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "kb");

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const categoryRaw = formData.get("category") as string;

    if (!file || !categoryRaw) {
      return NextResponse.json({ error: "Missing file or category" }, { status: 400 });
    }

    const category = categoryRaw as KbCategory;
    if (!Object.values(KbCategory).includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create uploads dir if it doesn't exist
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileExt = path.extname(file.name) || ".tmp";
    const tempFileName = `${randomUUID()}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, tempFileName);

    await fs.writeFile(filePath, buffer);

    const document = await prisma.knowledgeDocument.create({
      data: {
        title: file.name,
        category,
        source: "Upload API",
        status: "PROCESSING",
        clinicId: tenantId,
      }
    });

    await enqueueDocumentProcessing({
      documentId: document.id,
      filePath,
      mimeType: file.type
    });

    return NextResponse.json({ 
      success: true, 
      documentId: document.id, 
      status: "PROCESSING" 
    }, { status: 202 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/kb/documents/upload error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
