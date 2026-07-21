/**
 * ⚠️  INTERNAL REPOSITORY — SYSTEM ADMINISTRATION ONLY
 *
 * This repository is NOT exposed to any public-facing API.
 * It is used exclusively by authenticated admin Dashboard operations
 * where the caller has already been verified as a clinic administrator.
 *
 * SECURITY NOTICE:
 * - Methods like findById(), update(), delete() operate by entity ID without clinicId scope.
 * - Do NOT use this repository from any public API route or webhook handler.
 * - Any new usage must be reviewed and must include caller-side clinicId verification.
 * - Future enforcement of clinicId in all write methods is tracked as a post-MVP improvement.
 */
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
