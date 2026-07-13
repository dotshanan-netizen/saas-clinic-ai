import { IDoctorRepository, IDoctorWithRelations } from "../interfaces/IDoctorRepository";
import { Doctor, DoctorBranch, DoctorService, EntityStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export class PrismaDoctorRepository implements IDoctorRepository {
  async findById(id: string): Promise<Doctor | null> {
    return prisma.doctor.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(id: string): Promise<IDoctorWithRelations | null> {
    return prisma.doctor.findUnique({
      where: { id },
      include: {
        branches: {
          include: {
            branch: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
      },
    });
  }

  async findAllByClinicSlug(clinicSlug: string): Promise<IDoctorWithRelations[]> {
    return prisma.doctor.findMany({
      where: {
        clinic: {
          slug: clinicSlug,
        },
      },
      include: {
        branches: {
          include: {
            branch: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(
    clinicSlug: string,
    data: { name: string; specialty: string; imageUrl?: string | null }
  ): Promise<Doctor> {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { slug: clinicSlug },
    });

    return prisma.doctor.create({
      data: {
        name: data.name,
        specialty: data.specialty,
        imageUrl: data.imageUrl,
        clinicId: clinic.id,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      specialty?: string;
      imageUrl?: string | null;
      status?: EntityStatus;
    }
  ): Promise<Doctor> {
    return prisma.doctor.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Doctor> {
    return prisma.doctor.delete({
      where: { id },
    });
  }

  // Relation Management
  async linkToBranch(doctorId: string, branchId: string): Promise<DoctorBranch> {
    return prisma.doctorBranch.upsert({
      where: {
        doctorId_branchId: { doctorId, branchId },
      },
      create: { doctorId, branchId },
      update: {},
    });
  }

  async unlinkFromBranch(doctorId: string, branchId: string): Promise<void> {
    await prisma.doctorBranch.deleteMany({
      where: { doctorId, branchId },
    });
  }

  async linkToService(doctorId: string, serviceId: string): Promise<DoctorService> {
    return prisma.doctorService.upsert({
      where: {
        doctorId_serviceId: { doctorId, serviceId },
      },
      create: { doctorId, serviceId },
      update: {},
    });
  }

  async unlinkFromService(doctorId: string, serviceId: string): Promise<void> {
    await prisma.doctorService.deleteMany({
      where: { doctorId, serviceId },
    });
  }

  // Bulk relations sync (clears and sets)
  async syncBranches(doctorId: string, branchIds: string[]): Promise<void> {
    const deleteOp = prisma.doctorBranch.deleteMany({ where: { doctorId } });
    if (branchIds.length === 0) {
      await deleteOp;
      return;
    }
    await prisma.$transaction([
      deleteOp,
      prisma.doctorBranch.createMany({
        data: branchIds.map((branchId) => ({ doctorId, branchId })),
      }),
    ]);
  }

  async syncServices(doctorId: string, serviceIds: string[]): Promise<void> {
    const deleteOp = prisma.doctorService.deleteMany({ where: { doctorId } });
    if (serviceIds.length === 0) {
      await deleteOp;
      return;
    }
    await prisma.$transaction([
      deleteOp,
      prisma.doctorService.createMany({
        data: serviceIds.map((serviceId) => ({ doctorId, serviceId })),
      }),
    ]);
  }
}
export default PrismaDoctorRepository;
