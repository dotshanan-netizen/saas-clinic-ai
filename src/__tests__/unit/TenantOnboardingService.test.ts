import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantOnboardingService } from "../../lib/services/TenantOnboardingService";
import { TenantOnboardingPayload } from "../../lib/validations/onboarding";
import { PrismaClient } from "../../generated/prisma";
import { encrypt } from "../../lib/encryption";
import bcrypt from "bcryptjs";

// Mock Prisma
vi.mock("../../generated/prisma", () => {
  const mockPrisma = {
    clinic: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    branch: {
      create: vi.fn(),
    },
    service: {
      create: vi.fn(),
    },
    doctor: {
      create: vi.fn(),
    },
    document: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

const prisma = new PrismaClient();

describe("TenantOnboardingService", () => {
  const validPayload: TenantOnboardingPayload = {
    adminEmail: "admin@testclinic.com",
    adminPassword: "Password123!",
    adminName: "Admin User",
    clinicSlug: "test-clinic",
    clinicName: "Test Clinic",
    branches: [{ name: "Main", city: "Riyadh", address: "123 St" }],
    services: [{ name: "Consultation", description: "General", durationMinutes: 30 }],
    doctors: [{ name: "Dr. Smith", specialty: "General", branchIndexes: [0], serviceIndexes: [0] }],
    whatsappToken: "mock-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes mock key
    process.env.JWT_SECRET = "supersecret";
  });

  it("should throw error if ENCRYPTION_KEY is missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    await expect(TenantOnboardingService.onboard(validPayload)).rejects.toThrow(/ENCRYPTION_KEY is required/);
  });

  it("should throw error if clinic slug already exists", async () => {
    (prisma.clinic.findUnique as any).mockResolvedValueOnce({ id: "existing-id" });
    await expect(TenantOnboardingService.onboard(validPayload)).rejects.toThrow(/already exists/);
  });

  it("should execute full onboarding successfully", async () => {
    (prisma.clinic.findUnique as any).mockResolvedValueOnce(null);
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);

    (prisma.clinic.create as any).mockResolvedValueOnce({ id: "clinic-1", name: "Test Clinic" });
    (prisma.branch.create as any).mockResolvedValueOnce({ id: "branch-1" });
    (prisma.service.create as any).mockResolvedValueOnce({ id: "service-1" });

    const clinic = await TenantOnboardingService.onboard(validPayload);

    expect(clinic.id).toBe("clinic-1");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.clinic.create).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.branch.create).toHaveBeenCalled();
    expect(prisma.service.create).toHaveBeenCalled();
    expect(prisma.doctor.create).toHaveBeenCalled();
  });
});
