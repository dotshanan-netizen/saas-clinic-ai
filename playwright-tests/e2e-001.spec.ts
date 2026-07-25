import { test, expect } from '@playwright/test';

test.describe('E2E-001: Create Tenant via Onboarding', () => {
  test('should complete the 5-step onboarding and redirect to login', async ({ page }) => {
    
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
    await expect(page.locator('h2')).toContainText('الربط التقني');
    
    // Fill WhatsApp Info
    await page.fill('input[placeholder="1234567890"]', '1234567890');
    await page.fill('input[placeholder="0987654321"]', '0987654321');
    await page.fill('input[placeholder="EAA..."]', 'EAATestToken123');
    await page.fill('input[placeholder="my-secret-verify-token"]', 'my-secret-token');
    
    // We can click Test Connection, but we'll just skip to Next
    await page.click('button:has-text("التالي: العمليات")');

    // Step 3: Operations
    await expect(page.locator('h2')).toContainText('العمليات الأساسية');

    // Add Branch
    await page.fill('input[placeholder="اسم الفرع"]', 'فرع العليا');
    await page.fill('input[placeholder="المدينة"]', 'الرياض');
    await page.click('div:has-text("الفروع") + div button:has-text("إضافة")'); // It might be tricky, let's use exact locators if needed
    // Let's rely on placeholder proximity or just the button in the first flex group
    
    // Wait, the structure is:
    // div > h3 "الفروع" > div.flex > button "إضافة"
    // Let's use `locator.nth()` or better selectors
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

    // Submit
    await page.click('button:has-text("إنشاء العيادة")');

    // Assert Redirect to Login
    await page.waitForURL('**/login?onboarded=true', { timeout: 15000 });
    
    console.log("✅ Successfully created clinic and redirected to login!");
  });
});
