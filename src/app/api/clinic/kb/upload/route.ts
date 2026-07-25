import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Simple text chunker
function chunkText(text: string, maxLen: number = 500): string[] {
  const paragraphs = text.split("\n").map(p => p.trim()).filter(p => p.length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) > maxLen && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = p;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${p}` : p;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  
  return chunks;
}

export async function POST(req: Request) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, category } = body;
    const clinicId = tenantId; // Override with secure tenant session

    if (!title || !content || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // 1. Create Document
    const document = await prisma.knowledgeDocument.create({
      data: {
        clinicId,
        title,
        category,
        source: "Manual Upload",
        status: "APPROVED",
      }
    });

    // 2. Chunk text
    const textChunks = chunkText(content, 600);

    // 3. Generate Embeddings & Store in DB
    for (const chunk of textChunks) {
      try {
        const response = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: chunk
        });
        
        const embedding = response.embeddings?.[0]?.values;
        if (!embedding || embedding.length !== 768) {
          console.error("Invalid embedding shape:", embedding?.length);
          continue;
        }

        // Must use $executeRaw for vector insertion because Prisma doesn't natively support it yet
        const vectorStr = `[${embedding.join(",")}]`;
        
        // Use cuid to generate an ID
        const { randomUUID } = await import("crypto");
        const chunkId = randomUUID();

        await prisma.$executeRaw`
          INSERT INTO "KnowledgeChunk" (id, "documentId", content, embedding)
          VALUES (${chunkId}, ${document.id}, ${chunk}, ${vectorStr}::vector(768));
        `;

      } catch (err) {
        console.error("Failed to embed chunk:", err);
      }
    }

    return NextResponse.json({ success: true, documentId: document.id, chunksProcessed: textChunks.length });

  } catch (error) {
    console.error("Error in KB Upload API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
