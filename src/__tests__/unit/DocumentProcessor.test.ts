import { describe, it, expect, vi, beforeEach } from "vitest";
import { documentWorker } from "@/lib/infrastructure/queue/DocumentProcessorQueue";
import { Job } from "bullmq";

const mockPrisma = vi.hoisted(() => ({
  knowledgeDocument: { update: vi.fn() },
  knowledgeChunk: { deleteMany: vi.fn() },
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

import fs from "fs/promises";
vi.mock("fs/promises");
const mockFs = vi.mocked(fs);

// Mock GoogleGenAI
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        embedContent: vi.fn().mockResolvedValue({
          embeddings: [{ values: new Array(768).fill(0.1) }]
        })
      };
    }
  };
});

describe("DocumentProcessor Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process TXT file correctly and mark as INDEXED", async () => {
    const fakeJob = {
      id: "job-123",
      data: {
        documentId: "doc-1",
        filePath: "/tmp/fake.txt",
        mimeType: "text/plain"
      }
    } as unknown as Job;

    mockFs.readFile.mockResolvedValue(Buffer.from("This is a test paragraph for chunking."));
    mockFs.unlink.mockResolvedValue(undefined);

    // Mock prisma responses
    mockPrisma.knowledgeDocument.update.mockResolvedValue({} as any);
    mockPrisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.$executeRaw.mockResolvedValue(1);

    // Execute the worker logic directly
    const processFn = (documentWorker as any).processFn;
    const result = await processFn(fakeJob);

    expect(result.success).toBe(true);
    expect(result.processedChunks).toBe(1);

    // Verify status was updated to PROCESSING then INDEXED
    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PROCESSING" } })
    );
    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "INDEXED" } })
    );

    // Verify temp file was deleted
    expect(mockFs.unlink).toHaveBeenCalledWith("/tmp/fake.txt");
    
    // Verify embedding was inserted
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("should fail gracefully if file extraction fails", async () => {
    const fakeJob = {
      id: "job-456",
      data: {
        documentId: "doc-2",
        filePath: "/tmp/fake2.pdf",
        mimeType: "application/pdf"
      }
    } as unknown as Job;

    mockFs.readFile.mockRejectedValue(new Error("File missing"));

    const processFn = (documentWorker as any).processFn;
    
    await expect(processFn(fakeJob)).rejects.toThrow("File missing");

    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } })
    );
  });
});
