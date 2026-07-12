import { Branch, WorkingHour, EntityStatus } from "@/generated/prisma";

export interface IBranchRepository {
  findById(id: string): Promise<Branch | null>;
  findAllByClinicSlug(clinicSlug: string): Promise<Branch[]>;
  create(clinicSlug: string, data: { name: string; city?: string; address: string; phone?: string | null }): Promise<Branch>;
  update(
    id: string,
    data: {
      name?: string;
      city?: string;
      address?: string;
      phone?: string | null;
      status?: EntityStatus;
    }
  ): Promise<Branch>;
  delete(id: string): Promise<Branch>;

  // Working Hours CRUD
  getWorkingHours(branchId: string): Promise<WorkingHour[]>;
  upsertWorkingHour(
    branchId: string,
    dayOfWeek: string,
    data: { startTime: string; endTime: string; isClosed: boolean }
  ): Promise<WorkingHour>;
}
