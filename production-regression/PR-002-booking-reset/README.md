# PR-002: Booking Reset

| Field          | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Incident ID**   | PR-002                                                             |
| **Incident Name** | booking-reset                                                      |
| **Status**        | PASSING (with DB mocks)                                            |
| **Level**         | 1 (BusinessEngine Replay)                                          |
| **Root Cause**    | BUG-B2: `slotIsAvailable` required exact match, no fallback        |
| **Fix Commit**    | `ff8d225` — added endMatch, includeMatch, hourMatch fallbacks       |
| **Bug Doc**       | `docs/investigations/PHASE_A_ROOT_CAUSE.md` (B2 section)           |
| **Fixture**       | `production-regression/PR-002-booking-reset/fixture.ts`            |

## Description

When a user provides a time expression like "10 ص" during booking,
the Double Booking Guard's slot matching loop only checked for an
exact match (`slot === cleanTimeSlot`). Since the user's abbreviated
expression never matched the full canonical slot format
(`الإثنين 10:00 ص`), `slotIsAvailable` remained `false`, causing
the booking to be rejected with a false negative.

The B2 fix added three fallback matchers:
- **endMatch**: slot ends with the user's time
- **includeMatch**: slot contains the user's time
- **hourMatch**: same hour, regardless of format

## Replay Steps

1. User provides all booking details including time "10 ص"
2. BusinessEngine processes through validation → availability check
3. Slot loop finds match via fallback matchers
4. `cleanTimeSlot` is updated to the canonical slot value
5. Booking proceeds

## DB Requirements

This fixture requires prisma mocks:
- `prismaMock.doctor.findFirst` → doctor with schedule (e.g., MONDAY 09:00-17:00)
- `prismaMock.booking.findMany` → empty (no existing bookings)

## Verification

- [x] Slot matching with fallback works
- [x] cleanTimeSlot updated to canonical slot
- [x] No false negative on availability check
- [x] Booking proceeds to creation
