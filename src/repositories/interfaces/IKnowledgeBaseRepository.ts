import { KnowledgeBase, KbCategory } from "@/generated/prisma";

export interface IKnowledgeBaseRepository {
  findById(id: string): Promise<KnowledgeBase | null>;
  findAllByClinicSlug(clinicSlug: string): Promise<KnowledgeBase[]>;
  create(
    clinicSlug: string,
    data: { category: KbCategory; content: string }
  ): Promise<KnowledgeBase>;
  update(
    id: string,
    data: {
      category?: KbCategory;
      content?: string;
    }
  ): Promise<KnowledgeBase>;
  delete(id: string): Promise<KnowledgeBase>;
}
