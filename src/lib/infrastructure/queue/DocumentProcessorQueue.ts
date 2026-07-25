import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import mammoth from "mammoth";
import { ConnectionManager } from "../resilience/ConnectionManager";
import { randomUUID } from "crypto";

const connection = ConnectionManager.getRedisConnection("document-processing");
const ai = ConnectionManager.getGoogleGenAI();

export const documentProcessingQueue = new Queue("document-processing", { connection });

export interface DocumentJobPayload {
  documentId: string;
  filePath: string;
  mimeType: string;
}

export async function enqueueDocumentProcessing(payload: DocumentJobPayload) {
  await documentProcessingQueue.add("process-doc", payload, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 }
  });
}

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

export const documentWorker = new Worker(
  "document-processing",
  async (job: Job<DocumentJobPayload>) => {
    const { documentId, filePath, mimeType } = job.data;
    console.log(`[DocumentWorker] Starting job ${job.id} for document ${documentId}`);
    
    try {
      // 1. Mark as processing
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "PROCESSING" }
      });

      // 2. Read file
      const fileBuffer = await fs.readFile(filePath);
      let rawText = "";

      // 3. Extract text
      if (mimeType === "application/pdf") {
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(fileBuffer);
        rawText = data.text;
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        mimeType === "application/msword" ||
        filePath.endsWith(".docx")
      ) {
        const data = await mammoth.extractRawText({ buffer: fileBuffer });
        rawText = data.value;
      } else if (mimeType.startsWith("text/") || filePath.endsWith(".txt") || filePath.endsWith(".md")) {
        rawText = fileBuffer.toString("utf-8");
      } else {
        throw new Error(`Unsupported mimeType: ${mimeType}`);
      }

      // Cleanup local file after successful read
      await fs.unlink(filePath).catch(err => console.error("Failed to delete temp file", err));

      if (!rawText || rawText.trim().length === 0) {
        throw new Error("Extracted text is empty");
      }

      // 4. Delete existing chunks if this is a re-index
      await prisma.knowledgeChunk.deleteMany({
        where: { documentId }
      });

      // 5. Chunk and Embed
      const textChunks = chunkText(rawText, 800);
      let processed = 0;

      for (const chunk of textChunks) {
        try {
          const response = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: chunk
          });
          
          const embedding = response.embeddings?.[0]?.values;
          if (!embedding || embedding.length !== 768) continue;

          const vectorStr = `[${embedding.join(",")}]`;
          const chunkId = randomUUID();

          await prisma.$executeRaw`
            INSERT INTO "KnowledgeChunk" (id, "documentId", content, embedding)
            VALUES (${chunkId}, ${documentId}, ${chunk}, ${vectorStr}::vector(768));
          `;
          processed++;
        } catch (embedErr) {
          console.error(`[DocumentWorker] Failed to embed chunk in doc ${documentId}:`, embedErr);
        }
      }

      // 6. Mark as INDEXED
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "INDEXED" }
      });

      console.log(`[DocumentWorker] Finished job ${job.id}. Processed ${processed}/${textChunks.length} chunks.`);
      return { success: true, processedChunks: processed };

    } catch (error) {
      console.error(`[DocumentWorker] Failed to process document ${documentId}:`, error);
      
      // Cleanup file if it still exists
      try { await fs.unlink(filePath); } catch {}

      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "FAILED" }
      });
      throw error; // Let BullMQ handle retries
    }
  },
  { connection }
);
