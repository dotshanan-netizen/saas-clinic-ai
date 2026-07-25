import { prisma } from "../db";
import { TenantOnboardingPayload } from "../validations/onboarding";
import { encrypt } from "../encryption";
import bcrypt from "bcryptjs";
import { Logger } from "../infrastructure/logging/Logger";
import path from "path";
import fs from "fs/promises";

// Prisma imported from db

export class TenantOnboardingService {
  /**
   * Main entry point to onboard a tenant using an atomic transaction.
   */
  static async onboard(payload: TenantOnboardingPayload) {
    console.log(`[TenantOnboarding] Starting onboarding for ${payload.clinicSlug}`);

    // 1. Validate environment
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is required in environment variables.");
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in environment variables.");
    }

    // 2. Check for existence (slug, admin email)
    const existingClinic = await prisma.clinic.findUnique({
      where: { slug: payload.clinicSlug },
    });
    if (existingClinic) {
      throw new Error(`Clinic with slug '${payload.clinicSlug}' already exists.`);
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: payload.adminEmail },
    });
    if (existingAdmin) {
      throw new Error(`Admin with email '${payload.adminEmail}' already exists.`);
    }

    // 3. Prepare Encrypted Tokens
    let encryptedToken = undefined;
    if (payload.whatsappToken) {
      const { iv, authTag, encryptedData } = encrypt(payload.whatsappToken);
      encryptedToken = `${iv}:${authTag}:${encryptedData}`;
    }

    // 4. Hash Admin Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(payload.adminPassword, salt);

    // 5. Execute Atomic Transaction
    const clinic = await prisma.$transaction(async (tx) => {
      // Create Clinic
      const newClinic = await tx.clinic.create({
        data: {
          slug: payload.clinicSlug,
          name: payload.clinicName,
          logoUrl: payload.logoUrl,
          description: payload.description,
          contactPhone: payload.contactPhone,
          welcomeMessage: payload.welcomeMessage,
          customPrompt: payload.customPrompt,
          whatsappPhoneId: payload.whatsappPhoneId,
          whatsappWabaId: payload.whatsappWabaId,
          whatsappVerifyToken: payload.whatsappVerifyToken,
          whatsappToken: encryptedToken,
          isAiActive: false, // Default false until verified
        },
      });

      // Create Admin
      await tx.user.create({
        data: {
          email: payload.adminEmail,
          passwordHash: hashedPassword,
          name: payload.adminName,
          role: "ADMIN",
          clinicId: newClinic.id,
        },
      });

      // Create Branches
      const branches: any[] = [];
      for (const b of payload.branches) {
        const branch = await tx.branch.create({
          data: {
            name: b.name,
            city: b.city,
            address: b.address ?? "",
            phone: b.phone,
            clinicId: newClinic.id,
          },
        });
        branches.push(branch);
      }

      // Create Services
      const services: any[] = [];
      for (const s of payload.services) {
        const service = await tx.service.create({
          data: {
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            price: s.price ?? 0,
            clinicId: newClinic.id,
          },
        });
        services.push(service);
      }

      // Create Doctors and link, and add default schedule
      for (const d of payload.doctors) {
        const newDoc = await tx.doctor.create({
          data: {
            name: d.name,
            specialty: d.specialty,
            imageUrl: d.imageUrl,
            clinicId: newClinic.id,
            branches: {
              create: d.branchIndexes.map((idx) => ({ branchId: branches[idx].id })),
            },
            services: {
              create: d.serviceIndexes.map((idx) => ({ serviceId: services[idx].id })),
            },
          },
        });

        // Add default schedule: Sunday to Thursday, 09:00 to 17:00
        const defaultDays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"];
        for (const day of defaultDays) {
          await tx.doctorSchedule.create({
            data: {
              doctorId: newDoc.id,
              dayOfWeek: day,
              startTime: "09:00",
              endTime: "17:00",
              isClosed: false
            }
          });
        }
      }

      // Create KnowledgeBase entries if provided
      if (payload.knowledgeBase && payload.knowledgeBase.length > 0) {
        for (const kb of payload.knowledgeBase) {
          await tx.knowledgeBase.create({
            data: {
              clinicId: newClinic.id,
              category: kb.category as any,
              content: kb.content,
            },
          });
        }
      }

      return newClinic;
    });

    console.log(`[TenantOnboarding] Clinic ${clinic.name} created successfully with ID: ${clinic.id}`);

    // 6. Optionally process KB
    if (payload.knowledgeBaseFilePath) {
      try {
        console.log(`[TenantOnboarding] Processing KB file from ${payload.knowledgeBaseFilePath}`);
        const resolvedPath = path.resolve(process.cwd(), payload.knowledgeBaseFilePath);
        const stats = await fs.stat(resolvedPath);
        
        // Ensure DocumentProcessor handles the upload correctly
        // (Assuming a method to add document directly or using the worker)
        // Here we can just create the document record and let the worker process it
        const doc = await prisma.document.create({
          data: {
            clinicId: clinic.id,
            title: path.basename(resolvedPath),
            type: "TXT", // simplistic assumption for now
            status: "PENDING",
            size: stats.size,
            url: resolvedPath, // in local it's just a file path
          }
        });
        console.log(`[TenantOnboarding] Document ${doc.id} queued for processing.`);
      } catch (err) {
        console.error(`[TenantOnboarding] Failed to enqueue KB file: ${err}`);
      }
    }

    return clinic;
  }
}
