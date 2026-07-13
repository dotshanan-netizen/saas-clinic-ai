import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

test.describe("Sprint 3C: Services Catalog Frontend UI Tests", () => {
  const testServiceName = "تنظيف بشرة هيدرافيشيل E2E";

  test.beforeEach(async () => {
    // Delete any previous E2E test service to ensure clean state
    await prisma.doctorService.deleteMany({
      where: {
        service: { name: testServiceName },
      },
    });
    await prisma.service.deleteMany({
      where: { name: testServiceName },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings, switch to services tab, create service, and verify in database", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Go to Settings Page
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Switch to "الخدمات الطبية" Tab
    await page.click("text=الخدمات الطبية");

    // 4. Click "+ إضافة خدمة جديدة"
    await page.click("text=إضافة خدمة جديدة");

    // 5. Fill service form modal
    await page.fill('input[placeholder="مثال: حقن بوتكس، تنظيف بشرة عميق"]', testServiceName);
    await page.fill('input[placeholder="0"]', "450");
    await page.fill('input[placeholder="30"]', "45");
    await page.fill('textarea[placeholder="اكتب تفاصيل مختصرة حول الخدمة الطبية أو التجميلية..."]', "تنظيف وتقشير عميق للبشرة باستخدام أحدث الأجهزة التجريبية");

    // Set up network response waiter for service creation POST
    const createServicePromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/services") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 6. Click "حفظ الخدمة"
    await page.click("button:has-text('حفظ الخدمة')");

    // Wait for API response
    const createServiceRes = await createServicePromise;
    const createServiceData = await createServiceRes.json();
    const serviceId = createServiceData.id;
    expect(serviceId).toBeDefined();

    // 7. Verify the new service row is displayed in the table
    await expect(page.locator(`text=${testServiceName}`)).toBeVisible();

    // 8. Directly verify DB record is updated
    const dbService = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    expect(dbService).not.toBeNull();
    expect(dbService!.name).toBe(testServiceName);
    expect(dbService!.price).toBe(450);
    expect(dbService!.durationMinutes).toBe(45);
    expect(dbService!.description).toBe("تنظيف وتقشير عميق للبشرة باستخدام أحدث الأجهزة التجريبية");
  });
});
