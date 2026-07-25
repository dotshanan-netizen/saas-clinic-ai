import { prisma } from "@/lib/db";

export interface AIContext {
  services: { name: string; description: string | null; price: number; duration: number }[];
  knowledge: { category: string; content: string }[];
  doctors: { name: string; specialty: string }[];
  clinic: { name: string; customPrompt: string | null; welcomeMessage: string | null; operatingHours: string | null };
}

/**
 * Retrieve all relevant context for a specific clinic.
 * For an MVP, retrieving all services and active knowledge base items is highly efficient
 * and fits easily within modern LLM context windows (e.g., Gemini's 1M-2M context).
 */
export async function retrieveClinicContext(clinicId: string): Promise<AIContext | null> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      services: {
        where: { status: "ACTIVE" },
        select: { name: true, description: true, price: true, durationMinutes: true }
      },
      knowledgeBase: {
        select: { category: true, content: true }
      },
      doctors: {
        where: { status: "ACTIVE" },
        select: { name: true, specialty: true }
      }
    }
  });

  if (!clinic) return null;

  return {
    clinic: {
      name: clinic.name,
      customPrompt: clinic.customPrompt,
      welcomeMessage: clinic.welcomeMessage,
      operatingHours: clinic.operatingHours,
    },
    services: clinic.services.map(s => ({
      name: s.name,
      description: s.description,
      price: s.price,
      duration: s.durationMinutes
    })),
    knowledge: clinic.knowledgeBase,
    doctors: clinic.doctors,
  };
}
