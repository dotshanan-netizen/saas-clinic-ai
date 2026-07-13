import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

test.describe("Sprint 3A: Clinic Profile Frontend UI Tests", () => {
  const clinicSlug = "rival-clinic";

  test.beforeEach(async () => {
    // Reset clinic name in DB before test to guarantee clean slate
    await prisma.clinic.update({
      where: { slug: clinicSlug },
      data: { name: "عيادة ريفال للتجميل" },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings page, load profile, edit profile, and successfully save changes", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Click on "⚙️ إعدادات العيادة" navigation link
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Confirm Settings Page title is present
    await expect(page.locator("h1")).toContainText("إعدادات المنصة والعيادة");

    // 4. Fill in new Clinic Name
    const newName = "عيادة ريفال للتجميل E2E";
    const nameInput = page.locator('input[placeholder="مثال: عيادة ريفال للتجميل"]');
    await expect(nameInput).toHaveValue("عيادة ريفال للتجميل");
    await nameInput.fill(newName);

    // 5. Change AI Toggle status
    const aiCheckbox = page.locator('input[type="checkbox"]');
    const isChecked = await aiCheckbox.isChecked();
    // Click the visual slider div next to the input to trigger standard event propagation
    await page.locator('input[type="checkbox"] + div').click();
    expect(await aiCheckbox.isChecked()).toBe(!isChecked);

    // Set up network response waiter for the POST request before clicking
    const postResponsePromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/config") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 6. Click on "حفظ التعديلات ✨"
    await page.click("text=حفظ التعديلات");

    // Wait for the POST request API response to finish successfully
    await postResponsePromise;

    // 7. Verify success alert/banner is displayed in UI
    await expect(page.locator("text=تم حفظ الملف التعريفي للعيادة بنجاح")).toBeVisible();

    // 8. Directly verify DB record is updated
    const dbClinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
    });
    expect(dbClinic).not.toBeNull();
    expect(dbClinic!.name).toBe(newName);
    expect(dbClinic!.isAiActive).toBe(!isChecked);
  });
});
