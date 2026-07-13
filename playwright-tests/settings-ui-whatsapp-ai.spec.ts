import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";
import { decrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

test.describe("Sprint 3F: WhatsApp & AI Settings Frontend UI Tests", () => {
  const clinicSlug = "rival-clinic";

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings, switch to whatsapp-ai tab, edit config, and verify encrypted DB state", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Go to Settings Page
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Switch to "قنوات الاتصال والذكاء" Tab
    await page.click("text=قنوات الاتصال والذكاء");

    // 4. Fill configurations
    await page.fill("label:has-text('معرف رقم الهاتف') + input", "1234567890123");
    await page.fill("label:has-text('معرف حساب الأعمال') + input", "9876543210987");
    await page.fill("input[type='password']", "EAAGb_E2E_TEST_TOKEN_123");
    await page.fill("label:has-text('رمز التحقق لـ Webhook') + input", "VERIFY_TOKEN_E2E_123");
    await page.fill("label:has-text('تعليمات وتوجيهات النظام المخصصة') + textarea", "أنت مساعد ذكي تجريبي لاختبارات E2E.");

    // Toggle AI Active Switch (locate the sibling div of the checkbox)
    const toggleCheckbox = page.locator("input[type='checkbox']");
    await expect(toggleCheckbox).toBeAttached();
    // We click the slider div next to it
    await page.locator("input[type='checkbox'] + div").click();

    // Set up network response waiter for configuration POST
    const savePromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/config") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 5. Click "حفظ التغييرات"
    await page.click("button:has-text('حفظ التغييرات')");

    // Wait for API response
    await savePromise;

    // 6. Verify UI success alert
    await expect(page.locator("text=تم حفظ الإعدادات وتحديث سلوك المساعد")).toBeVisible();

    // 7. Directly verify DB record
    const dbClinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
    });
    expect(dbClinic).not.toBeNull();
    expect(dbClinic!.whatsappPhoneId).toBe("1234567890123");
    expect(dbClinic!.whatsappWabaId).toBe("9876543210987");
    expect(dbClinic!.customPrompt).toBe("أنت مساعد ذكي تجريبي لاختبارات E2E.");
    expect(dbClinic!.whatsappVerifyToken).toBe("VERIFY_TOKEN_E2E_123");

    // 8. Verify the WhatsApp Access Token is encrypted securely in DB using AES-256-GCM
    const tokenField = dbClinic!.whatsappToken;
    expect(tokenField).not.toBeNull();
    const parts = tokenField!.split(":");
    expect(parts.length).toBe(3);

    const [iv, authTag, encryptedData] = parts;
    const decrypted = decrypt(encryptedData, iv, authTag);
    expect(decrypted).toBe("EAAGb_E2E_TEST_TOKEN_123");
  });
});
