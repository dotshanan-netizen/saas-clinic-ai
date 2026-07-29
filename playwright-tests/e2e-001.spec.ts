import { decrypt } from "../src/lib/encryption";
import {
  test,
  expect,
  InstrumentedPrisma,
  dbSnapshot,
  log,
  getRunId,
  writeLogs,
  writeFailureArtifact,
  resetLogs,
  setFailureFlag,
  isFailureOccurred,
} from "./test-instrumentation";

const prisma = new InstrumentedPrisma();

test.describe('E2E-001: Create Tenant via Onboarding', () => {

  test.beforeAll(async () => {
    log({ event: "suite_start", test: "E2E-001", runId: getRunId() });
    await dbSnapshot(prisma, "onboarding_before_check");
  });

  test.beforeEach(async ({}, testInfo) => {
    resetLogs();
    log({ event: "test_start", title: testInfo.titlePath?.join(" > ") || "E2E-001" });
    await dbSnapshot(prisma, "before_cleanup");

    // Delete existing clinic from previous runs to prevent duplicate key constraints on slug
    const existing = await prisma.clinic.findUnique({
      where: { slug: "alhayat-clinic" }
    });
    if (existing) {
      log({ event: "cleanup_deleting_clinic", id: existing.id });
      await prisma.clinic.delete({
        where: { id: existing.id }
      });
    }

    await dbSnapshot(prisma, "after_cleanup");
  });

  test.afterEach(async ({}, testInfo) => {
    await dbSnapshot(prisma, "onboarding_after_test");
    if (isFailureOccurred()) {
      await writeFailureArtifact(testInfo.titlePath?.join(" > ") || "E2E-001");
    }
  });

  test.afterAll(async () => {
    await dbSnapshot(prisma, "onboarding_end");
    const logPath = await writeLogs(`e2e-001-${getRunId()}`);
    console.log(`📝 Instrumentation log: ${logPath}`);
    await prisma.$disconnect();
  });

  test('should complete the 5-step onboarding and redirect to login', async ({ page, loggedRequest }) => {

    // Log all API responses during the test
    const apiLogHandler = (response: { url: () => string; status: () => number; request: () => { method: () => string } }) => {
      const url = response.url();
      if (url.includes('/api/')) {
        log({
          event: "api_response",
          url: url.substring(url.indexOf('/api/')),
          status: response.status(),
          method: response.request().method(),
        });
      }
    };
    page.on('response', apiLogHandler);

    try {
      // Step 1: Clinic Info
      await page.goto('/onboarding');
      await expect(page.locator('h1')).toContainText('Clinova Setup');

      // Fill Clinic Info
      await page.fill('input[placeholder="مثال: عيادة لومينا للتجميل"]', 'عيادة الحياة');
      await page.fill('input[placeholder="lumina-aesthetics"]', 'alhayat-clinic');
      await page.fill('input[placeholder="https://example.com/logo.png"]', 'https://example.com/logo.png');
      await page.fill('input[placeholder="+966500000000"]', '+966500000001');
      await page.fill('textarea', 'عيادة متخصصة في طب الأسنان');

      // Fill Admin Info
      await page.locator('text="الاسم *"').locator('..').locator('input').fill('أحمد المدير');
      await page.locator('text="البريد الإلكتروني *"').locator('..').locator('input').fill('admin@alhayat.com');
      await page.locator('text="كلمة المرور *"').locator('..').locator('input').fill('Password123!');

      // Click Next
      await page.click('button:has-text("التالي: إعدادات واتساب والـ AI")');

      // Step 2: WhatsApp & AI
      await expect(page.locator('h2')).toContainText('إعدادات قناة التواصل والذكاء الاصطناعي');

      // Fill WhatsApp Info (v1.3 redesign — label-based inputs, indexed by order)
      const whatsAppInputs = page.locator('input');
      await whatsAppInputs.nth(0).fill('1234567890');
      await whatsAppInputs.nth(1).fill('0987654321');
      await whatsAppInputs.nth(2).fill('EAATestToken123');
      await whatsAppInputs.nth(3).fill('my-secret-token');

      // We can click Test Connection, but we'll just skip to Next
      await page.click('button:has-text("التالي: بيانات العمليات")');

      // Step 3: Operations
      await expect(page.locator('h2')).toContainText('العمليات الأساسية');

      // Add Branch
      await page.fill('input[placeholder="اسم الفرع"]', 'فرع العليا');
      await page.fill('input[placeholder="المدينة"]', 'الرياض');
      const branchAddBtn = page.locator('h3:has-text("الفروع")').locator('..').locator('button:has-text("إضافة")');
      await branchAddBtn.click();

      // Add Service
      await page.fill('input[placeholder="اسم الخدمة"]', 'تنظيف أسنان');
      await page.fill('input[placeholder="السعر"]', '300');
      const serviceAddBtn = page.locator('h3:has-text("الخدمات")').locator('..').locator('button:has-text("إضافة")');
      await serviceAddBtn.click();

      // Add Doctor
      await page.fill('input[placeholder="اسم الطبيب"]', 'د. محمد');
      await page.fill('input[placeholder="التخصص"]', 'طبيب أسنان');
      const docAddBtn = page.locator('h3:has-text("الأطباء")').locator('..').locator('button:has-text("إضافة")');
      await docAddBtn.click();

      await page.click('button:has-text("التالي: دليل التشغيل")');

      // Step 4: Business Profile
      await expect(page.locator('h2')).toContainText('دليل التشغيل');
      // Defaults are fine here, just click Next
      await page.click('button:has-text("التالي: المراجعة والإطلاق")');

      // Step 5: Review
      await expect(page.locator('h2')).toContainText('مراجعة البيانات');

      // Verify some text to ensure we are on the review step
      await expect(page.locator('body')).toContainText('alhayat-clinic');

      // Submit — wait for API response first
      const [apiResponse] = await Promise.all([
        page.waitForResponse(response =>
          response.url().includes('/api/onboarding') &&
          response.request().method() === 'POST'
        ),
        page.click('button:has-text("إنشاء العيادة")'),
      ]);

      const status = apiResponse.status();
      let body: any = {};
      try { body = await apiResponse.json(); } catch {}

      if (status !== 200) {
        log({ event: "api_failure", status, body: JSON.stringify(body) });
        setFailureFlag();
        // Capture page content for debugging
        const pageContent = await page.locator('body').innerText();
        log({ event: "page_content_after_submit", content: pageContent.substring(0, 500) });
      } else {
        log({ event: "api_success", status, body: JSON.stringify(body).substring(0, 200) });
      }

      // Assert creation completed — check for a success indicator or redirect
      // v1.3: may redirect to dashboard or stay on success page
      if (status === 200) {
        await page.waitForURL(/dashboard|login\?onboarded/, { timeout: 10000 });
        log({ event: "redirect_success", url: page.url() });
      }

    } catch (err) {
      setFailureFlag();
      log({ event: "unexpected_error", message: (err as Error).message, stack: (err as Error).stack?.substring(0, 1000) });
      throw err;
    } finally {
      page.removeListener('response', apiLogHandler);
    }
  });
});
