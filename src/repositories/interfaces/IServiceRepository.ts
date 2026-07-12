import { Service, EntityStatus } from "@/generated/prisma";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  findAllByClinicSlug(clinicSlug: string): Promise<Service[]>;
  create(
    clinicSlug: string,
    data: { name: string; description?: string | null; price: number; durationMinutes?: number }
  ): Promise<Service>;
  update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      price?: number;
      durationMinutes?: number;
      status?: EntityStatus;
    }
  ): Promise<Service>;
  delete(id: string): Promise<Service>;
}
