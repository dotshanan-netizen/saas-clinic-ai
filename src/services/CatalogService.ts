import { IServiceRepository } from "@/repositories/interfaces/IServiceRepository";
import { IDoctorRepository, IDoctorWithRelations } from "@/repositories/interfaces/IDoctorRepository";
import { UpsertServiceDto, UpsertDoctorDto } from "@/dtos";
import { DomainEventBus, ClinicCatalogUpdatedEvent } from "@/lib/events";
import { Service, Doctor } from "@/generated/prisma";

export class CatalogService {
  constructor(
    private serviceRepository: IServiceRepository,
    private doctorRepository: IDoctorRepository
  ) {}

  // Service Management
  async getServices(clinicSlug: string): Promise<Service[]> {
    return this.serviceRepository.findAllByClinicSlug(clinicSlug);
  }

  async getService(id: string): Promise<Service | null> {
    return this.serviceRepository.findById(id);
  }

  async upsertService(dto: UpsertServiceDto): Promise<Service> {
    let service: Service;

    if (dto.id) {
      service = await this.serviceRepository.update(dto.id, {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        status: dto.status,
      });

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(service.clinicId, "service", service.id, "update")
      );
    } else {
      service = await this.serviceRepository.create(dto.clinicSlug, {
        name: dto.name,
        description: dto.description || undefined,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
      });

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(service.clinicId, "service", service.id, "create")
      );
    }

    return service;
  }

  async deleteService(id: string): Promise<Service> {
    const service = await this.serviceRepository.delete(id);
    DomainEventBus.publish(
      new ClinicCatalogUpdatedEvent(service.clinicId, "service", service.id, "delete")
    );
    return service;
  }

  // Doctor Management
  async getDoctors(clinicSlug: string): Promise<IDoctorWithRelations[]> {
    return this.doctorRepository.findAllByClinicSlug(clinicSlug);
  }

  async getDoctor(id: string): Promise<Doctor | null> {
    return this.doctorRepository.findById(id);
  }

  async getDoctorWithRelations(id: string): Promise<IDoctorWithRelations | null> {
    return this.doctorRepository.findByIdWithRelations(id);
  }

  async upsertDoctor(dto: UpsertDoctorDto): Promise<Doctor> {
    let doctor: Doctor;

    if (dto.id) {
      doctor = await this.doctorRepository.update(dto.id, {
        name: dto.name,
        specialty: dto.specialty,
        imageUrl: dto.imageUrl || undefined,
        status: dto.status,
      });

      // Sync links
      await this.doctorRepository.syncBranches(doctor.id, dto.branchIds);
      await this.doctorRepository.syncServices(doctor.id, dto.serviceIds);

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(doctor.clinicId, "doctor", doctor.id, "update")
      );
    } else {
      doctor = await this.doctorRepository.create(dto.clinicSlug, {
        name: dto.name,
        specialty: dto.specialty,
        imageUrl: dto.imageUrl || undefined,
      });

      // Sync links
      await this.doctorRepository.syncBranches(doctor.id, dto.branchIds);
      await this.doctorRepository.syncServices(doctor.id, dto.serviceIds);

      DomainEventBus.publish(
        new ClinicCatalogUpdatedEvent(doctor.clinicId, "doctor", doctor.id, "create")
      );
    }

    return doctor;
  }

  async deleteDoctor(id: string): Promise<Doctor> {
    const doctor = await this.doctorRepository.delete(id);
    DomainEventBus.publish(
      new ClinicCatalogUpdatedEvent(doctor.clinicId, "doctor", doctor.id, "delete")
    );
    return doctor;
  }
}
export default CatalogService;
