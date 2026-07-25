import { GoogleGenAI } from "@google/genai";

// Ensure you have GEMINI_API_KEY in your environment variables
const ai = new GoogleGenAI({});

/**
 * Generate a 768-dimensional embedding for a given text using Gemini's text-embedding-004 model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    
    const embedding = response.embeddings?.[0]?.values;
    
    if (!embedding) {
      throw new Error("Failed to generate embedding: No values returned from Gemini API.");
    }
    
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
