import { z } from "zod";
import { EntityStatus, KbCategory } from "@/generated/prisma";

// Clinic Profile DTO
export const UpdateClinicConfigSchema = z.object({
  clinicSlug: z.string().min(1),
  name: z.string().min(3, "يجب أن يكون الاسم 3 حروف على الأقل"),
  logoUrl: z.string().url("رابط الشعار غير صالح").optional().or(z.literal("")),
  description: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  operatingHours: z.string().optional().nullable(),
  welcomeMessage: z.string().optional().nullable(),
  customPrompt: z.string().optional().nullable(),
  
  // WhatsApp Settings (access tokens must be sanitized before output)
  whatsappPhoneId: z.string().optional().nullable(),
  whatsappToken: z.string().optional().nullable(),
  whatsappWabaId: z.string().optional().nullable(),
  whatsappVerifyToken: z.string().optional().nullable(),
  isAiActive: z.boolean().optional().default(true),
});

export type UpdateClinicConfigDto = z.infer<typeof UpdateClinicConfigSchema>;

// Branch DTO
export const UpsertBranchSchema = z.object({
  id: z.string().optional(),
  clinicSlug: z.string().min(1),
  name: z.string().min(3, "يجب أن يكون الاسم 3 حروف على الأقل"),
  city: z.string().min(2, "يجب أن تكون المدينة حرفين على الأقل").default("الرياض"),
  address: z.string().min(5, "يجب أن يكون العنوان 5 حروف على الأقل"),
  phone: z.string().optional().nullable(),
  status: z.nativeEnum(EntityStatus).optional().default(EntityStatus.ACTIVE),
});

export type UpsertBranchDto = z.infer<typeof UpsertBranchSchema>;

// Branch Working Hour Detail DTO
export const WorkingHourItemSchema = z.object({
  dayOfWeek: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  isClosed: z.boolean(),
});

export const UpdateBranchWorkingHoursSchema = z.object({
  clinicSlug: z.string().min(1),
  branchId: z.string().min(1),
  hours: z.array(WorkingHourItemSchema),
});

export type UpdateBranchWorkingHoursDto = z.infer<typeof UpdateBranchWorkingHoursSchema>;

// Service DTO
export const UpsertServiceSchema = z.object({
  id: z.string().optional(),
  clinicSlug: z.string().min(1),
  name: z.string().min(2, "يجب أن يكون اسم الخدمة حرفين على الأقل"),
  description: z.string().optional().nullable(),
  price: z.number().positive("يجب أن يكون السعر قيمة موجبة"),
  durationMinutes: z.number().int().min(5, "يجب أن تكون الجلسة 5 دقائق على الأقل").optional().default(30),
  status: z.nativeEnum(EntityStatus).optional().default(EntityStatus.ACTIVE),
});

export type UpsertServiceDto = z.infer<typeof UpsertServiceSchema>;

// Doctor DTO
export const UpsertDoctorSchema = z.object({
  id: z.string().optional(),
  clinicSlug: z.string().min(1),
  name: z.string().min(3, "يجب أن يكون اسم الطبيب 3 حروف على الأقل"),
  specialty: z.string().min(3, "يجب أن يكون التخصص 3 حروف على الأقل"),
  imageUrl: z.string().url("رابط الصورة غير صالح").optional().or(z.literal("")).nullable(),
  status: z.nativeEnum(EntityStatus).optional().default(EntityStatus.ACTIVE),
  branchIds: z.array(z.string()).default([]),
  serviceIds: z.array(z.string()).default([]),
});

export type UpsertDoctorDto = z.infer<typeof UpsertDoctorSchema>;

// Knowledge Base DTO
export const UpsertKbSchema = z.object({
  id: z.string().optional(),
  clinicSlug: z.string().min(1),
  category: z.nativeEnum(KbCategory),
  content: z
    .string()
    .min(5, "يجب أن يكون المحتوى 5 حروف على الأقل")
    .max(1500, "يجب ألا يتجاوز محتوى المستند 1500 حرف لضمان ثبات التدريب المعرفي"),
});

export type UpsertKbDto = z.infer<typeof UpsertKbSchema>;
