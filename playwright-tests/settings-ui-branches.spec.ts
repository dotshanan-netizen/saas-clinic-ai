import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

test.describe("Sprint 3B: Branches & Operating Hours Frontend UI Tests", () => {
  const testBranchName = "فرع الصحافة التجريبي E2E";

  test.beforeEach(async () => {
    // Delete any previous E2E test branch to ensure clean state
    const existingBranch = await prisma.branch.findFirst({
      where: { name: testBranchName },
    });
    if (existingBranch) {
      await prisma.workingHour.deleteMany({ where: { branchId: existingBranch.id } });
      await prisma.doctorBranch.deleteMany({ where: { branchId: existingBranch.id } });
      await prisma.branch.delete({ where: { id: existingBranch.id } });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings, switch to branches tab, create branch, and edit working hours", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Go to Settings Page
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Switch to "الفروع وأوقات العمل" Tab
    await page.click("text=الفروع وأوقات العمل");

    // 4. Click "+ إضافة فرع جديد"
    await page.click("text=إضافة فرع جديد");

    // 5. Fill branch form modal
    await page.fill('input[placeholder="مثال: فرع الصحافة، فرع التحلية"]', testBranchName);
    await page.fill('input[placeholder="011XXXXXXX"]', "0559998887");
    await page.fill('input[placeholder="مثال: طريق الملك فهد، حي الصحافة"]', "طريق الملك فهد، حي الصحافة التجريبي");

    // Set up network response waiter for branch creation POST
    const createBranchPromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/branches") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 6. Click "حفظ الفرع"
    await page.click("button:has-text('حفظ الفرع')");

    // Wait for API response
    const createBranchRes = await createBranchPromise;
    const createBranchData = await createBranchRes.json();
    const branchId = createBranchData.id;
    expect(branchId).toBeDefined();

    // 7. Verify the new branch row is displayed in the table
    await expect(page.locator(`text=${testBranchName}`)).toBeVisible();

    // 8. Open "🕒 ساعات العمل" editor for the new branch
    const branchRow = page.locator("tr", { hasText: testBranchName });
    await branchRow.locator("button:has-text('ساعات العمل')").click();

    // 9. Verify the editor panel is visible
    await expect(page.locator("h3:has-text('أوقات عمل فرع')")).toBeVisible();

    // 10. Toggle MONDAY to closed
    // Monday is the 3rd row in DAYS_ORDER (Saturday, Sunday, Monday)
    const mondayRow = page.locator("tr", { hasText: "الإثنين" });
    const mondayCheckbox = mondayRow.locator('input[type="checkbox"]');
    const isMondayClosed = await mondayCheckbox.isChecked();
    
    // Toggle the checkbox
    await mondayCheckbox.click();
    expect(await mondayCheckbox.isChecked()).toBe(!isMondayClosed);

    // Set up network response waiter for working hours save POST
    const saveHoursPromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/branches/working-hours") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 11. Click "حفظ ساعات العمل"
    await page.click("button:has-text('حفظ ساعات العمل')");

    // Wait for API response
    await saveHoursPromise;

    // 12. Verify success alert is displayed
    await expect(page.locator("text=تم تحديث ساعات العمل بنجاح")).toBeVisible();

    // 13. Directly verify DB records are updated
    const dbBranch = await prisma.branch.findUnique({
      where: { id: branchId },
    });
    expect(dbBranch).not.toBeNull();
    expect(dbBranch!.name).toBe(testBranchName);
    expect(dbBranch!.phone).toBe("0559998887");

    const dbMondayHours = await prisma.workingHour.findFirst({
      where: { branchId, dayOfWeek: "MONDAY" },
    });
    expect(dbMondayHours).not.toBeNull();
    expect(dbMondayHours!.isClosed).toBe(!isMondayClosed);
  });
});
