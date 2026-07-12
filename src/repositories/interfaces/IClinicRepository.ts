import { Clinic } from "@/generated/prisma";

export interface IClinicRepository {
  findBySlug(slug: string): Promise<Clinic | null>;
  findById(id: string): Promise<Clinic | null>;
  update(id: string, data: Partial<Omit<Clinic, "id" | "createdAt">>): Promise<Clinic>;
}
