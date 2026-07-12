import { IBranchRepository } from "@/repositories/interfaces/IBranchRepository";
import { UpsertBranchDto, UpdateBranchWorkingHoursDto } from "@/dtos";
import { DomainEventBus, ClinicCatalogUpdatedEvent } from "@/lib/events";
import { Branch, WorkingHour } from "@/generated/prisma";

export class BranchService {
  constructor(private branchRepository: IBranchRepository) {}

  async getBranches(clinicSlug: string): Promise<Branch[]> {
    return this.branchRepository.findAllByClinicSlug(clinicSlug);
  }

  async getBranch(id: string): Promise<Branch | null> {
    return this.branchRepository.findById(id);
  }

  async upsertBranch(dto: UpsertBranchDto): Promise<Branch> {
    let branch: Branch;

    if (dto.id) {
      branch = await this.branchRepository.update(dto.id, {
        name: dto.name,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        status: dto.status,
      });

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(branch.clinicId, "branch", branch.id, "update")
      );
    } else {
      branch = await this.branchRepository.create(dto.clinicSlug, {
        name: dto.name,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
      });

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(branch.clinicId, "branch", branch.id, "create")
      );
    }

    return branch;
  }

  async deleteBranch(id: string): Promise<Branch> {
    const branch = await this.branchRepository.delete(id);
    DomainEventBus.publish(
      new ClinicCatalogUpdatedEvent(branch.clinicId, "branch", branch.id, "delete")
    );
    return branch;
  }

  async getWorkingHours(branchId: string): Promise<WorkingHour[]> {
    return this.branchRepository.getWorkingHours(branchId);
  }

  async updateWorkingHours(dto: UpdateBranchWorkingHoursDto): Promise<WorkingHour[]> {
    const results: WorkingHour[] = [];
    for (const h of dto.hours) {
      const hour = await this.branchRepository.upsertWorkingHour(dto.branchId, h.dayOfWeek, {
        startTime: h.startTime,
        endTime: h.endTime,
        isClosed: h.isClosed,
      });
      results.push(hour);
    }

    const branch = await this.branchRepository.findById(dto.branchId);
    if (branch) {
      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(branch.clinicId, "branch", branch.id, "update")
      );
    }

    return results;
  }
}
export default BranchService;
