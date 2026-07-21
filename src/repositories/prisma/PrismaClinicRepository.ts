/**
 * ⚠️  INTERNAL REPOSITORY — SYSTEM ADMINISTRATION ONLY
 *
 * This repository is NOT exposed to any public-facing API.
 * It is used exclusively by authenticated admin Dashboard operations
 * where the caller has already been verified as a clinic administrator.
 *
 * SECURITY NOTICE:
 * - Methods like findById(), update() operate by entity ID without clinicId scope.
 * - Do NOT use this repository from any public API route or webhook handler.
 * - Any new usage must be reviewed and must include caller-side clinicId verification.
 * - Future enforcement of clinicId in all write methods is tracked as a post-MVP improvement.
 */
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
