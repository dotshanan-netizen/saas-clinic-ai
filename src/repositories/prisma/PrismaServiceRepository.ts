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
