import { IClinicRepository } from "../interfaces/IClinicRepository";
import { Clinic } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export class PrismaClinicRepository implements IClinicRepository {
  async findBySlug(slug: string): Promise<Clinic | null> {
    return prisma.clinic.findUnique({
      where: { slug },
    });
  }

  async findById(id: string): Promise<Clinic | null> {
    return prisma.clinic.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Partial<Omit<Clinic, "id" | "createdAt">>): Promise<Clinic> {
    return prisma.clinic.update({
      where: { id },
      data,
    });
  }
}
export default PrismaClinicRepository;
