import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

test.describe("Sprint 3E: Knowledge Base RAG Frontend UI Tests", () => {
  const testContent = "سياسة الإلغاء: المواعيد الملغاة يجب تأكيدها قبل 24 ساعة E2E";

  test.beforeEach(async () => {
    // Delete any previous E2E test KB item to ensure clean state
    await prisma.knowledgeBase.deleteMany({
      where: { content: testContent },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should navigate to settings, switch to kb tab, create kb entry, verify in database, and delete it", async ({ page }) => {
    // 1. Go to reception dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("لوحة موظف الاستقبال");

    // 2. Go to Settings Page
    await page.click("text=⚙️ إعدادات العيادة");
    await page.waitForURL("**/dashboard/settings");

    // 3. Switch to "قاعدة المعرفة RAG" Tab
    await page.click("text=قاعدة المعرفة RAG");

    // 4. Click "+ إضافة مستند معرفي"
    await page.click("text=إضافة مستند معرفي");

    // 5. Fill KB form modal
    await page.selectOption("select", "POLICY");
    await page.fill('textarea[placeholder*="اكتب المعرفة هنا بوضوح"]', testContent);

    // Set up network response waiter for KB creation POST
    const createKbPromise = page.waitForResponse(response =>
      response.url().includes("/api/clinic/kb") &&
      response.request().method() === "POST" &&
      response.status() === 200
    );

    // 6. Click "حفظ المستند"
    await page.click("button:has-text('حفظ المستند')");

    // Wait for API response
    const createKbRes = await createKbPromise;
    const createKbData = await createKbRes.json();
    const kbId = createKbData.id;
    expect(kbId).toBeDefined();

    // 7. Verify the new KB item content is displayed in the list
    await expect(page.locator(`text=${testContent}`)).toBeVisible();

    // 8. Directly verify DB record is created
    const dbKb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
    });
    expect(dbKb).not.toBeNull();
    expect(dbKb!.content).toBe(testContent);
    expect(dbKb!.category).toBe("POLICY");

    // 9. Setup automatic browser confirm dialogue accept for deletion
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("هل أنت متأكد من حذف هذا المستند المعرفي؟");
      await dialog.accept();
    });

    // Set up network response waiter for KB deletion
    const deleteKbPromise = page.waitForResponse(response =>
      response.url().includes(`/api/clinic/kb?kbId=${kbId}`) &&
      response.request().method() === "DELETE" &&
      response.status() === 200
    );

    // 10. Click "حذف" on that item row
    // We locate the delete button inside the row that contains our testContent
    const row = page.locator("tr", { hasText: testContent });
    await row.locator("button:has-text('حذف')").click();

    // Wait for delete response
    await deleteKbPromise;

    // 11. Assert it is no longer visible in UI
    await expect(page.locator(`text=${testContent}`)).not.toBeVisible();

    // 12. Assert it is deleted from database
    const deletedDbKb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
    });
    expect(deletedDbKb).toBeNull();
  });
});
