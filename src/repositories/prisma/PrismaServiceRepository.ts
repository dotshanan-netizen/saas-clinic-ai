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
import { IServiceRepository } from "../interfaces/IServiceRepository";
import { Service, EntityStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export class PrismaServiceRepository implements IServiceRepository {
  async findById(id: string): Promise<Service | null> {
    return prisma.service.findUnique({
      where: { id },
    });
  }

  async findAllByClinicSlug(clinicSlug: string): Promise<Service[]> {
    return prisma.service.findMany({
      where: {
        clinic: {
          slug: clinicSlug,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(
    clinicSlug: string,
    data: { name: string; description?: string | null; price: number; durationMinutes?: number }
  ): Promise<Service> {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { slug: clinicSlug },
    });

    return prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        durationMinutes: data.durationMinutes ?? 30,
        clinicId: clinic.id,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      price?: number;
      durationMinutes?: number;
      status?: EntityStatus;
    }
  ): Promise<Service> {
    return prisma.service.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Service> {
    return prisma.service.delete({
      where: { id },
    });
  }
}
export default PrismaServiceRepository;
