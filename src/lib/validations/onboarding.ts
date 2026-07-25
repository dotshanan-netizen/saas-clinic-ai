import { z } from "zod";

export const BranchOnboardingSchema = z.object({
  name: z.string().min(3),
  city: z.string().min(2),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export const ServiceOnboardingSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().or(z.literal("")),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  price: z.number().min(0).optional(),
});

export const DoctorOnboardingSchema = z.object({
  name: z.string().min(3),
  specialty: z.string().min(3),
  imageUrl: z.string().url().optional(),
  branchIndexes: z.array(z.number()), // index of the branch in the branches array
  serviceIndexes: z.array(z.number()), // index of the service in the services array
});

export const TenantOnboardingSchema = z.object({
  // Admin Data
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminName: z.string().min(2),

  // Clinic Data
  clinicSlug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  clinicName: z.string().min(3),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  contactPhone: z.string().optional(),
  welcomeMessage: z.string().optional(),
  customPrompt: z.string().optional(),

  // WhatsApp Secrets (Can be empty for now if in 2.1A)
  whatsappPhoneId: z.string().optional(),
  whatsappWabaId: z.string().optional(),
  whatsappToken: z.string().optional(),
  whatsappVerifyToken: z.string().optional(),

  // KB File path (optional for script)
  knowledgeBaseFilePath: z.string().optional(),

  // Nested entities
  branches: z.array(BranchOnboardingSchema).default([]),
  services: z.array(ServiceOnboardingSchema).default([]),
  doctors: z.array(DoctorOnboardingSchema).default([]),
});

export type TenantOnboardingPayload = z.infer<typeof TenantOnboardingSchema>;
