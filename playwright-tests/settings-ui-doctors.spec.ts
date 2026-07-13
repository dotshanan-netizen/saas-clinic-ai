import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

test.describe("Sprint 3D: Doctors & Relations Frontend UI Tests", () => {
  const testDoctorName = "د. ريان التجريبي E2E";

  test.beforeEach(async () => {
    // Delete any previous E2E test doctor to ensure clean state
    const existingDoctor = await prisma.doctor.findFirst({
      where: { name: testDoctorName },
    });
    if (existingDoctor) {
      await prisma.doctorBranch.deleteMany({ where: { doctorId: existingDoctor.id } });
      await prisma.doctorService.deleteMany({ where: { doctorId: existingDoctor.id } });
      await prisma.doctor.delete({ where: { id: existingDoctor.id } });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings, switch to doctors tab, create doctor, select relations, and verify in database", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Go to Settings Page
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Switch to "الأطباء والطاقم" Tab
    await page.click("text=الأطباء والطاقم");

    // 4. Click "+ إضافة طبيب جديد"
    await page.click("text=إضافة طبيب جديد");

    // 5. Fill doctor form modal
    await page.fill('input[placeholder="مثال: د. نجلاء، د. أحمد"]', testDoctorName);
    await page.fill('input[placeholder="مثال: أخصائية جلدية وتجميل"]', "أخصائي فيلر وبوتكس");
    await page.fill('input[placeholder="https://example.com/ryan.png"]', "https://rival-clinic.com/ryan.png");

    // 6. Select the first available branch checkbox
    const branchCheckbox = page.locator("h4:has-text('الفروع المتاحة للعمل') + div input[type='checkbox']").first();
    await expect(branchCheckbox).toBeVisible();
    await branchCheckbox.click({ force: true });
    expect(await branchCheckbox.isChecked()).toBe(true);

    // 7. Select the first available service checkbox
    const serviceCheckbox = page.locator("h4:has-text('الخدمات والعلاجات المقدمة') + div input[type='checkbox']").first();
    await expect(serviceCheckbox).toBeVisible();
    await serviceCheckbox.click({ force: true });
    expect(await serviceCheckbox.isChecked()).toBe(true);

    // Set up network response waiter for doctor creation POST
    const createDoctorPromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/doctors") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 8. Click "حفظ الطبيب"
    await page.click("button:has-text('حفظ الطبيب')");

    // Wait for API response
    const createDoctorRes = await createDoctorPromise;
    const createDoctorData = await createDoctorRes.json();
    const doctorId = createDoctorData.id;
    expect(doctorId).toBeDefined();

    // 9. Verify the new doctor row is displayed in the table
    await expect(page.locator(`text=${testDoctorName}`)).toBeVisible();

    // 10. Directly verify DB records are updated
    const dbDoctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        branches: true,
        services: true,
      },
    });
    expect(dbDoctor).not.toBeNull();
    expect(dbDoctor!.name).toBe(testDoctorName);
    expect(dbDoctor!.specialty).toBe("أخصائي فيلر وبوتكس");
    expect(dbDoctor!.imageUrl).toBe("https://rival-clinic.com/ryan.png");
    expect(dbDoctor!.branches.length).toBe(1);
    expect(dbDoctor!.services.length).toBe(1);
  });
});
