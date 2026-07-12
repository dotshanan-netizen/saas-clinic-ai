import { Doctor, DoctorBranch, DoctorService, EntityStatus } from "@/generated/prisma";

export interface IDoctorWithRelations extends Doctor {
  branches: DoctorBranch[];
  services: DoctorService[];
}

export interface IDoctorRepository {
  findById(id: string): Promise<Doctor | null>;
  findByIdWithRelations(id: string): Promise<IDoctorWithRelations | null>;
  findAllByClinicSlug(clinicSlug: string): Promise<IDoctorWithRelations[]>;
  create(
    clinicSlug: string,
    data: { name: string; specialty: string; imageUrl?: string | null }
  ): Promise<Doctor>;
  update(
    id: string,
    data: {
      name?: string;
      specialty?: string;
      imageUrl?: string | null;
      status?: EntityStatus;
    }
  ): Promise<Doctor>;
  delete(id: string): Promise<Doctor>;

  // Relation Management
  linkToBranch(doctorId: string, branchId: string): Promise<DoctorBranch>;
  unlinkFromBranch(doctorId: string, branchId: string): Promise<void>;
  linkToService(doctorId: string, serviceId: string): Promise<DoctorService>;
  unlinkFromService(doctorId: string, serviceId: string): Promise<void>;

  // Bulk relations sync (overwrites existing connections)
  syncBranches(doctorId: string, branchIds: string[]): Promise<void>;
  syncServices(doctorId: string, serviceIds: string[]): Promise<void>;
}
