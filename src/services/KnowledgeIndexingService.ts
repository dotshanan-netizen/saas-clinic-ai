import { prisma } from "@/lib/db";
import { AIProvider } from "@/lib/infrastructure/ai/AIProvider";
import { KbCategory } from "@/generated/prisma";

export class KnowledgeIndexingService {
  /**
   * Separated indexing logic for syncing KnowledgeBase entries to KnowledgeDocument/Chunk vectors.
   * This ensures the RAG logic is isolated from the core CRUD business logic.
   * In the future, this can be moved to a Background Worker (e.g. Inngest/BullMQ).
   */
  static async indexDocument(params: {
    kbId: string;
    clinicId: string;
    category: KbCategory;
    content: string;
  }) {
    try {
      const { kbId, clinicId, category, content } = params;
      const sourceKey = `KB-${kbId}`;

      const existingDoc = await prisma.knowledgeDocument.findFirst({
        where: { source: sourceKey, clinicId }
      });

      // Generate embedding using AIProvider
      const embedding = await AIProvider.generateEmbedding(content);

      if (existingDoc) {
        // Update Document & Chunk
        await prisma.knowledgeDocument.update({
          where: { id: existingDoc.id },
          data: { category, status: "PUBLISHED" }
        });
        
        // Find existing chunk
        const existingChunk = await prisma.knowledgeChunk.findFirst({
          where: { documentId: existingDoc.id }
        });

        if (existingChunk) {
          await prisma.knowledgeChunk.update({
            where: { id: existingChunk.id },
            data: { content }
          });
          
          await prisma.$executeRawUnsafe(`
            UPDATE "KnowledgeChunk" 
            SET embedding = $1::vector 
            WHERE id = $2
          `, `[${embedding.join(",")}]`, existingChunk.id);
        }
      } else {
        // Create Document & Chunk
        const newDoc = await prisma.knowledgeDocument.create({
          data: {
            title: `Entry: ${category}`,
            category,
            source: sourceKey,
            status: "PUBLISHED",
            clinicId,
          }
        });

        const newChunk = await prisma.knowledgeChunk.create({
          data: {
            documentId: newDoc.id,
            content,
          }
        });

        await prisma.$executeRawUnsafe(`
          UPDATE "KnowledgeChunk" 
          SET embedding = $1::vector 
          WHERE id = $2
        `, `[${embedding.join(",")}]`, newChunk.id);
      }
      console.log(`[KnowledgeIndexingService] Successfully indexed KB-${kbId}`);
    } catch (error) {
      console.error("[KnowledgeIndexingService] Failed to index KnowledgeDocument/Chunk for RAG:", error);
      // We do not throw here to prevent breaking the UI if AI embedding fails occasionally
    }
  }

  static async removeIndex(kbId: string, clinicId: string) {
    try {
      const sourceKey = `KB-${kbId}`;
      
      // We do a soft delete for the vector document by archiving it
      await prisma.knowledgeDocument.updateMany({
        where: { source: sourceKey, clinicId },
        data: { status: "ARCHIVED" }
      });

      // Optionally, we could clear the vectors here to save space, but keeping them archived is fine.
      // await prisma.$executeRawUnsafe(`UPDATE "KnowledgeChunk" SET embedding = NULL WHERE "documentId" IN (SELECT id FROM "KnowledgeDocument" WHERE source = $1)`, sourceKey);
      
      console.log(`[KnowledgeIndexingService] Successfully archived index for KB-${kbId}`);
    } catch (error) {
      console.error("[KnowledgeIndexingService] Failed to archive KnowledgeDocument:", error);
    }
  }
}
