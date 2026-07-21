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
import { IBranchRepository } from "../interfaces/IBranchRepository";
import { Branch, WorkingHour, EntityStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export class PrismaBranchRepository implements IBranchRepository {
  async findById(id: string): Promise<Branch | null> {
    return prisma.branch.findUnique({
      where: { id },
    });
  }

  async findAllByClinicSlug(clinicSlug: string): Promise<Branch[]> {
    return prisma.branch.findMany({
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
    data: { name: string; city?: string; address: string; phone?: string | null }
  ): Promise<Branch> {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { slug: clinicSlug },
    });

    return prisma.branch.create({
      data: {
        name: data.name,
        city: data.city || "الرياض",
        address: data.address,
        phone: data.phone,
        clinicId: clinic.id,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      city?: string;
      address?: string;
      phone?: string | null;
      status?: EntityStatus;
    }
  ): Promise<Branch> {
    return prisma.branch.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Branch> {
    return prisma.branch.delete({
      where: { id },
    });
  }

  // Working Hours CRUD
  async getWorkingHours(branchId: string): Promise<WorkingHour[]> {
    return prisma.workingHour.findMany({
      where: { branchId },
    });
  }

  async upsertWorkingHour(
    branchId: string,
    dayOfWeek: string,
    data: { startTime: string; endTime: string; isClosed: boolean }
  ): Promise<WorkingHour> {
    return prisma.workingHour.upsert({
      where: {
        branchId_dayOfWeek: {
          branchId,
          dayOfWeek,
        },
      },
      create: {
        branchId,
        dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        isClosed: data.isClosed,
      },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        isClosed: data.isClosed,
      },
    });
  }
}
export default PrismaBranchRepository;
