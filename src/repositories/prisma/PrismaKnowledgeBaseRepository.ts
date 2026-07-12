import { IKnowledgeBaseRepository } from "../interfaces/IKnowledgeBaseRepository";
import { KnowledgeBase, KbCategory } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export class PrismaKnowledgeBaseRepository implements IKnowledgeBaseRepository {
  async findById(id: string): Promise<KnowledgeBase | null> {
    return prisma.knowledgeBase.findUnique({
      where: { id },
    });
  }

  async findAllByClinicSlug(clinicSlug: string): Promise<KnowledgeBase[]> {
    return prisma.knowledgeBase.findMany({
      where: {
        clinic: {
          slug: clinicSlug,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async create(
    clinicSlug: string,
    data: { category: KbCategory; content: string }
  ): Promise<KnowledgeBase> {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { slug: clinicSlug },
    });

    return prisma.knowledgeBase.create({
      data: {
        category: data.category,
        content: data.content,
        clinicId: clinic.id,
      },
    });
  }

  async update(
    id: string,
    data: {
      category?: KbCategory;
      content?: string;
    }
  ): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.delete({
      where: { id },
    });
  }
}
export default PrismaKnowledgeBaseRepository;
