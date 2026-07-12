import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";
import { decrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

test.describe("Clinic Configuration Engine Integration Tests", () => {
  const clinicSlug = "rival-clinic";
  let targetBranchId: string;
  let targetServiceId: string;
  let targetDoctorId: string;
  let targetKbId: string;

  test.beforeAll(async () => {
    // Clear dynamic items that might conflict
    await prisma.workingHour.deleteMany({});
    await prisma.doctorBranch.deleteMany({});
    await prisma.doctorService.deleteMany({});
    await prisma.doctor.deleteMany({});
    await prisma.service.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.knowledgeBase.deleteMany({});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("1. Clinic Profile Config API - Encryption and Sanitization", async ({ request }) => {
    // GET initial profile
    const getRes = await request.get(`/api/clinic/config?clinicSlug=${clinicSlug}`);
    expect(getRes.ok()).toBeTruthy();
    const profile = await getRes.json();
    expect(profile.slug).toBe(clinicSlug);
    expect(profile.whatsappToken).toBeUndefined(); // Verify token is masked/sanitized
    expect(profile.whatsappVerifyToken).toBeUndefined();

    // UPDATE config with meta token
    const testToken = "EAAGyZCpZB0ZC8BAP123xyz_test_token_gcm";
    const updateRes = await request.post("/api/clinic/config", {
      data: {
        clinicSlug,
        name: "عيادة ريفال للتجميل المحدثة",
        logoUrl: "https://rival-clinic.com/logo.png",
        whatsappToken: testToken,
        whatsappVerifyToken: "verify_token_12345",
        isAiActive: true,
      },
    });

    expect(updateRes.ok()).toBeTruthy();
    const updatedProfile = await updateRes.json();
    expect(updatedProfile.name).toBe("عيادة ريفال للتجميل المحدثة");
    expect(updatedProfile.hasWhatsappToken).toBe(true);
    expect(updatedProfile.whatsappToken).toBeUndefined(); // Masked in response
    expect(updatedProfile.whatsappVerifyToken).toBeUndefined(); // Masked in response

    // Verify database contains ENCRYPTED token
    const dbClinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
    });
    expect(dbClinic).not.toBeNull();
    expect(dbClinic!.whatsappToken).not.toBe(testToken); // Must NOT be plain text

    // Decrypt and verify matching plain text
    const parts = dbClinic!.whatsappToken!.split(":");
    expect(parts.length).toBe(3); // iv:authTag:encryptedData
    const [iv, authTag, encryptedData] = parts;
    const decrypted = decrypt(encryptedData, iv, authTag);
    expect(decrypted).toBe(testToken);
  });

  test("2. Branch CRUD and Working Hours API", async ({ request }) => {
    // CREATE Branch
    const createRes = await request.post("/api/clinic/branches", {
      data: {
        clinicSlug,
        name: "فرع النرجس الجديد",
        city: "الرياض",
        address: "طريق عثمان بن عفان، حي النرجس",
        phone: "0551112223",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const branch = await createRes.json();
    expect(branch.name).toBe("فرع النرجس الجديد");
    targetBranchId = branch.id;

    // GET all branches
    const listRes = await request.get(`/api/clinic/branches?clinicSlug=${clinicSlug}`);
    expect(listRes.ok()).toBeTruthy();
    const branches = await listRes.json();
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.find((b: { id: string }) => b.id === targetBranchId)).toBeDefined();

    // UPDATE Working Hours for branch
    const hoursRes = await request.post("/api/clinic/branches/working-hours", {
      data: {
        clinicSlug,
        branchId: targetBranchId,
        hours: [
          { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "22:00", isClosed: false },
          { dayOfWeek: "FRIDAY", startTime: "00:00", endTime: "00:00", isClosed: true },
        ],
      },
    });
    expect(hoursRes.ok()).toBeTruthy();
    const workingHours = await hoursRes.json();
    expect(workingHours.length).toBe(2);

    // GET Working Hours
    const getHoursRes = await request.get(`/api/clinic/branches/working-hours?branchId=${targetBranchId}`);
    expect(getHoursRes.ok()).toBeTruthy();
    const hoursList = await getHoursRes.json();
    expect(
      hoursList.find((h: { dayOfWeek: string; startTime: string }) => h.dayOfWeek === "MONDAY").startTime
    ).toBe("10:00");
    expect(
      hoursList.find((h: { dayOfWeek: string; isClosed: boolean }) => h.dayOfWeek === "FRIDAY").isClosed
    ).toBe(true);
  });

  test("3. Service CRUD API", async ({ request }) => {
    // CREATE Service
    const createRes = await request.post("/api/clinic/services", {
      data: {
        clinicSlug,
        name: "خيوط شد الوجه",
        price: 2500,
        description: "شد البشرة وإعادة النضارة بخيوط طبية ممتازة.",
        durationMinutes: 45,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const service = await createRes.json();
    expect(service.name).toBe("خيوط شد الوجه");
    expect(service.price).toBe(2500);
    targetServiceId = service.id;

    // GET services
    const getRes = await request.get(`/api/clinic/services?clinicSlug=${clinicSlug}`);
    expect(getRes.ok()).toBeTruthy();
    const services = await getRes.json();
    expect(services.find((s: { id: string }) => s.id === targetServiceId)).toBeDefined();
  });

  test("4. Doctor CRUD and Relation Mapping API", async ({ request }) => {
    // CREATE Doctor with branch and service links
    const createRes = await request.post("/api/clinic/doctors", {
      data: {
        clinicSlug,
        name: "د. نجلاء",
        specialty: "أخصائية فيلر وبوتكس",
        branchIds: [targetBranchId],
        serviceIds: [targetServiceId],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const doctor = await createRes.json();
    expect(doctor.name).toBe("د. نجلاء");
    targetDoctorId = doctor.id;

    // GET doctors with relations
    const listRes = await request.get(`/api/clinic/doctors?clinicSlug=${clinicSlug}`);
    expect(listRes.ok()).toBeTruthy();
    const doctors = await listRes.json();
    interface DoctorTestItem {
      id: string;
      branches: { branchId: string }[];
      services: { serviceId: string }[];
    }
    const foundDoc = doctors.find((d: DoctorTestItem) => d.id === targetDoctorId);
    expect(foundDoc).toBeDefined();
    expect(foundDoc.branches.length).toBe(1);
    expect(foundDoc.branches[0].branchId).toBe(targetBranchId);
    expect(foundDoc.services.length).toBe(1);
    expect(foundDoc.services[0].serviceId).toBe(targetServiceId);
  });

  test("5. Knowledge Base CRUD API", async ({ request }) => {
    // CREATE FAQ
    const createRes = await request.post("/api/clinic/kb", {
      data: {
        clinicSlug,
        category: "FAQ",
        content: "س: متى تظهر نتائج البوتكس؟ ج: تظهر بعد 3 إلى 7 أيام وتكتمل النتيجة في اليوم الـ 14.",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const kb = await createRes.json();
    expect(kb.category).toBe("FAQ");
    targetKbId = kb.id;

    // GET FAQs
    const listRes = await request.get(`/api/clinic/kb?clinicSlug=${clinicSlug}`);
    expect(listRes.ok()).toBeTruthy();
    const items = await listRes.json();
    expect(items.find((i: { id: string }) => i.id === targetKbId)).toBeDefined();

    // DELETE FAQ
    const delRes = await request.delete(`/api/clinic/kb?kbId=${targetKbId}`);
    expect(delRes.ok()).toBeTruthy();
  });
});
