import { prisma } from "@/lib/db";
import { AIProvider } from "../infrastructure/ai/AIProvider";
import { ClinicWithCatalog } from "./types";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
}

export class RAGPipeline {
  
  /**
   * Retrieves relevant chunks based on vector similarity and metadata.
   */
  static async retrieve(
    clinicId: string,
    question: string,
    topK: number = 3
  ): Promise<RetrievedChunk[]> {
    // 1. Generate embedding for the question
    const questionEmbedding = await AIProvider.generateEmbedding(question);

    // 2. Perform Vector Search (Cosine Similarity)
    // We filter by clinicId and KnowledgeStatus = 'PUBLISHED'
    const query = `
      SELECT 
        c.id, 
        c."documentId", 
        c.content,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeDocument" d ON c."documentId" = d.id
      WHERE d."clinicId" = $2 AND d.status = 'PUBLISHED'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `;
    
    // Note: Prisma raw query parameters must be properly passed, especially for arrays/vectors
    // We format the array to a vector string: '[0.1, 0.2, ...]'
    const vectorString = `[${questionEmbedding.join(",")}]`;

    const results = await prisma.$queryRawUnsafe<any[]>(
      query,
      vectorString,
      clinicId,
      topK
    );

    // 3. Simple Logging for Citation/Audit
    console.log(`[RAG Retrieval] Found ${results.length} chunks for question: "${question}"`);
    results.forEach((r, i) => {
      console.log(`  [Chunk ${i+1}] DocID: ${r.documentId}, ChunkID: ${r.id}, Similarity: ${r.similarity.toFixed(4)}`);
    });

    return results.map(r => ({
      id: r.id,
      documentId: r.documentId,
      content: r.content,
      similarity: r.similarity,
    }));
  }

  /**
   * Performs Grounding Check and generates response
   */
  static async generateGroundedResponse(
    clinic: ClinicWithCatalog,
    question: string,
    chunks: RetrievedChunk[]
  ): Promise<string> {
    if (chunks.length === 0) {
      return "لا أملك معلومات كافية للإجابة على هذا السؤال، وسأحول استفسارك لموظف العيادة.";
    }

    const contextText = chunks.map((c, i) => `[مصدر ${i+1}]:\n${c.content}`).join("\n\n");

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("Gemini API Key missing");

    const prompt = `
أنتِ مساعدة ذكية لعيادة (${clinic.name}).
لقد سأل المستخدم سؤالاً استفسارياً. 
يجب عليك الإجابة بناءً على المعلومات التالية (المصادر) فقط.

[المصادر]
${contextText}

[سؤال المستخدم]
${question}

[التعليمات الصارمة جداً]
1. إذا كانت المصادر أعلاه لا تحتوي على معلومات كافية أو واضحة للإجابة على السؤال، يجب عليك ألا تؤلفي إجابة أو تخمني.
2. إذا لم تكن المعلومات موجودة، ردي حرفياً بهذه الجملة فقط: "NO_INFO"
3. إذا كانت المعلومات موجودة، أجيبي بلطف واختصار مستخدمة المعلومات المقدمة فقط.
`;

    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${geminiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Low temperature for high grounding
      }),
    });

    if (!response.ok) {
      console.error(`Grounding AI Error: ${await response.text()}`);
      return "لا أملك معلومات كافية للإجابة على هذا السؤال، وسأحول استفسارك لموظف العيادة.";
    }

    const data = await response.json();
    const rawAnswer = data.choices[0].message.content.trim();

    if (rawAnswer === "NO_INFO" || rawAnswer.includes("NO_INFO")) {
      console.log(`[RAG Grounding] Grounding Check Failed (NO_INFO). Fallback triggered.`);
      return "لا أملك معلومات كافية للإجابة على هذا السؤال، وسأحول استفسارك لموظف العيادة.";
    }

    console.log(`[RAG Grounding] Grounding Check Passed.`);
    return rawAnswer;
  }
}
