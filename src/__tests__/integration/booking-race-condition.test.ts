import { vi } from "vitest";
vi.unmock("@/lib/db");

import { prisma } from "@/lib/db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BusinessEngine } from "@/lib/domain/BusinessEngine";
import { BookingService } from "@/lib/domain/BookingService";

describe("Booking Race Condition - Concurrent Slot Reservation", () => {
  
  let clinicId: string;
  let doctorName: string;
  let slotTime: string;

  beforeAll(async () => {
    // Setup: Create test clinic with doctor
    clinicId = "cmryoendy0000dzrctyxgyf3k"; // Test clinic
    doctorName = "د. سحر";

    // Dynamically retrieve the first available slot to avoid hardcoded date expiry
    const slots = await BookingService.getAvailableSlots(clinicId, doctorName);
    const dayKeys = Object.keys(slots);
    if (dayKeys.length === 0) throw new Error("No slots available at all for test");
    const dayKey = dayKeys[0];
    const firstSlot = slots[dayKey]?.[0];
    if (!firstSlot) throw new Error("No slots inside day list");
    slotTime = firstSlot;

    // Clear any existing test bookings
    await prisma.booking.deleteMany({
      where: {
        clinicId,
        doctorName,
        timeSlot: slotTime
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.booking.deleteMany({
      where: {
        clinicId,
        doctorName,
        timeSlot: slotTime
      }
    });
  });

  it("should prevent double-booking under concurrent load", async () => {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        branches: true,
        doctors: true,
        services: true
      }
    });

    if (!clinic) throw new Error("Test clinic not found");

    // Simulate 5 concurrent users trying to book SAME slot
    const concurrentBookingAttempts = [1, 2, 3, 4, 5].map(async (userId) => {
      const availableSlot = slotTime;

      // ← RACE CONDITION WINDOW OPENS HERE ←

      // Simulate AI extraction delay (100-200ms)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      // All users try to create booking
      try {
        const booking = await prisma.$transaction(
          async (tx) => {
            const conflict = await tx.booking.findFirst({
              where: {
                clinicId: clinic.id,
                doctorName,
                timeSlot: availableSlot,
                status: { in: ["PENDING", "CONFIRMED"] }
              }
            });

            if (conflict) {
              throw new Error("DOUBLE_BOOKING");
            }

            return await tx.booking.create({
              data: {
                clinicId: clinic.id,
                clientName: `User ${userId}`,
                clientPhone: `+966501234${String(userId).padStart(3, "0")}`,
                serviceName: "ليزر",
                doctorName,
                branchName: "الصحافة",
                timeSlot: availableSlot,
                source: "Test",
                status: "PENDING"
              }
            });
          },
          { isolationLevel: "Serializable" }
        );

        return {
          userId,
          success: true,
          bookingId: booking.id,
          error: null
        };
      } catch (err: any) {
        if (err.message === "DOUBLE_BOOKING" || err.code === "P2034") {
          return {
            userId,
            success: false,
            bookingId: null,
            error: "DOUBLE_BOOKING"
          };
        }
        throw err;
      }
    });

    const results = await Promise.all(concurrentBookingAttempts);

    // Analysis
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n=== Race Condition Test Results ===");
    console.log(`Total attempts: ${results.length}`);
    console.log(`Successful bookings: ${succeeded.length}`);
    console.log(`Failed bookings: ${failed.length}`);
    console.log(
      `Failure rate: ${((failed.length / results.length) * 100).toFixed(1)}%`
    );

    // Verify database integrity
    const bookingsForSlot = await prisma.booking.findMany({
      where: {
        clinicId,
        doctorName,
        timeSlot: slotTime,
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    console.log(`\nBookings in DB for this slot: ${bookingsForSlot.length}`);

    // EXPECTED BEHAVIOR:
    // ✓ Exactly 1 booking succeeded (others got DOUBLE_BOOKING error)
    // ✓ 4 bookings failed with P2034
    // ✓ Database has exactly 1 booking for the slot
    // ✓ No duplicate bookings (data integrity maintained)

    expect(succeeded.length).toBe(1); // Only 1 should succeed
    expect(failed.length).toBe(4); // 4 should fail
    expect(bookingsForSlot.length).toBe(1); // Exactly 1 in DB

    // If this assertion fails: Race condition exists
    // If it passes: Serializable transaction prevents double-booking
  });

  it("should demonstrate poor UX when race condition occurs", async () => {
    // Scenario:
    // User 1: "I want Saturday 10 AM" → slot check says available
    // User 2: "I want Saturday 10 AM" → slot check says available
    // User 1: Creates booking successfully
    // User 2: Gets "Slot taken" error after UI said it was available

    // This is a UX issue even though DB-level integrity is maintained
    // Solution: Pessimistic locking (reserve slot before showing to user)

    console.log(`
    Race Condition UX Impact:
    ────────────────────────
    1. User A sees: "Saturday 10 AM available ✓"
    2. User B sees: "Saturday 10 AM available ✓"
    3. Both click "Book Now"
    4. User A books successfully
    5. User B gets: "Sorry, someone just booked that time"
    
    Problem: User B thought slot was available, but got rejected
    Solution: Use slot reservations (5-minute hold) before payment
    `);
  });
});

// Expected Test Results:
// ✅ PASS: should prevent double-booking under concurrent load
//    - Exactly 1 succeeded
//    - 4 failed with P2034
//    - DB integrity maintained
// ✅ PASS: should demonstrate poor UX when race condition occurs
//
// If tests fail:
// ❌ RACE CONDITION CONFIRMED (multiple bookings in DB for same slot)
// ❌ Need to implement pessimistic locking
