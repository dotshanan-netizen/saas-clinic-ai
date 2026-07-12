import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
test.describe("Reception Dashboard E2E Tests", () => {
  let bookingId: string;
  let testPhone: string;

  // Run before each test to ensure total independence and a clean database state
  test.beforeEach(async ({ page }) => {
    // Generate a unique parallel-safe Saudi phone number for this test run
    testPhone = "055" + Math.floor(1000000 + Math.random() * 9000000).toString();

    // 1. Fetch clinic
    const clinic = await prisma.clinic.findUnique({
      where: { slug: "rival-clinic" }
    });
    if (!clinic) throw new Error("Clinic not found for testing");

    // 2. Clean up any previous test state for this specific phone (just in case)
    await prisma.booking.deleteMany({
      where: {
        clinicId: clinic.id,
        clientPhone: testPhone
      }
    });

    // 3. Seed fresh PENDING booking
    const booking = await prisma.booking.create({
      data: {
        clientName: "منى محمد",
        clientPhone: testPhone,
        serviceName: "فيلر الشفايف",
        doctorName: "د. سحر",
        branchName: "فرع الصحافة",
        timeSlot: "مساء الأحد",
        status: "PENDING",
        clinicId: clinic.id,
        source: "WhatsApp"
      }
    });
    bookingId = booking.id;

    // 4. Navigate and select patient to reset UI state
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByTestId(`patient-btn-${testPhone}`).click();
    await page.waitForTimeout(500); // Allow react state transitions
  });

  // Run after each test to clean up
  test.afterEach(async () => {
    await prisma.booking.deleteMany({
      where: { clientPhone: testPhone }
    });
  });

  // Ensure DB connection is closed after all tests
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  // RD-UI-001: Verify pending booking details match DB
  test("RD-UI-001: should display pending booking details correctly in UI", async ({ page }) => {
    // Verify details panel using data-testid
    await expect(page.getByTestId("detail-client-name")).toHaveText("منى محمد");
    await expect(page.getByTestId("detail-client-phone")).toHaveText(testPhone);
    await expect(page.getByTestId("detail-service-name")).toHaveText("فيلر الشفايف");
    await expect(page.getByTestId("detail-doctor-name")).toHaveText("د. سحر");
    await expect(page.getByTestId("detail-branch-name")).toHaveText("فرع الصحافة");
    await expect(page.getByTestId("detail-time-slot")).toHaveText("مساء الأحد");

    // Verify Confirm/Cancel buttons are visible
    await expect(page.getByTestId("confirm-booking-btn")).toBeVisible();
    await expect(page.getByTestId("cancel-booking-btn")).toBeVisible();

    // Verify status in sidebar shows "قيد الانتظار"
    await expect(page.getByTestId(`patient-status-${testPhone}`)).toHaveText(/قيد الانتظار/);
  });

  // RD-UI-002: Confirm button action updates DB & UI
  test("RD-UI-002: should confirm booking correctly", async ({ page }) => {
    // Click Confirm button
    await page.getByTestId("confirm-booking-btn").click();

    // Verify confirmed banner displays (RD-UI-002)
    await expect(page.getByTestId("confirmed-status-banner")).toBeVisible();
    await expect(page.getByTestId("confirmed-status-banner")).toHaveText(/الحجز مؤكد/);

    // Verify sidebar item status changed to "مؤكد" (RD-UI-002)
    await expect(page.getByTestId(`patient-status-${testPhone}`)).toHaveText(/مؤكد/);

    // Verify DB updated to CONFIRMED
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("CONFIRMED");
  });

  // RD-UI-003: Cancel button action updates DB & UI
  test("RD-UI-003: should cancel booking correctly", async ({ page }) => {
    // Click Cancel button
    await page.getByTestId("cancel-booking-btn").click();

    // Verify cancelled banner displays (RD-UI-003)
    await expect(page.getByTestId("cancelled-status-banner")).toBeVisible();
    await expect(page.getByTestId("cancelled-status-banner")).toHaveText(/الموعد ملغى/);

    // Verify sidebar item status changed to "ملغى" (RD-UI-003)
    await expect(page.getByTestId(`patient-status-${testPhone}`)).toHaveText(/ملغى/);

    // Verify DB updated to CANCELLED
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("CANCELLED");
  });

  // RD-UI-004: UI buttons disappear after state changes
  test("RD-UI-004: should hide action buttons after status transition", async ({ page }) => {
    // 1. Confirm and verify buttons hide
    await page.getByTestId("confirm-booking-btn").click();
    await expect(page.getByTestId("confirm-booking-btn")).toBeHidden();
    await expect(page.getByTestId("cancel-booking-btn")).toBeHidden();

    // Verify DB updated
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("CONFIRMED");
  });
});
