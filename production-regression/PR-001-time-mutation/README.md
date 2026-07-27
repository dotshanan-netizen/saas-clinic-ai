# PR-001: Time Mutation

| Field          | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Incident ID**   | PR-001                                                             |
| **Incident Name** | time-mutation                                                      |
| **Status**        | PASSING                                                            |
| **Level**         | 1 (BusinessEngine Replay)                                          |
| **Root Cause**    | BUG-B1: `TimeNormalizer.ts` regex `[0-1]?` rejects hours 20–23    |
| **Fix Commit**    | `32a823f` — regex `[0-1]?` → `[0-2]?`                              |
| **Bug Doc**       | `docs/investigations/PHASE_A_ROOT_CAUSE.md` (B1 section)           |
| **Fixture**       | `production-regression/PR-001-time-mutation/fixture.ts`            |

## Description

When a user provides a 24-hour time like `23:00`, the TimeExtractor must
normalize it to `11:00 م` (PM), not `11:00 ص` (AM). Before the B1 fix,
the `TimeNormalizer` regex used `[0-1]?[0-9]:[0-5][0-9]` which rejects
hours 20-23, causing the time to fall through to an incorrect AM default.

The B1 fix expanded the hour regex to `[0-2]?[0-9]:[0-5][0-9]`, correctly
matching hours 0-23.

## Replay Steps

1. User says "أبغى أحجز بوتكس عند دكتورة سحر"
2. User says "الموعد 23:00"
   - TimeExtractor matches Pattern 3 (24h HH:MM): `23:00` → `11:00 م`
   - Deterministic override corrects LLM's incorrect AM extraction
   - Result: `timeSlot = "11:00 م"`

## Verification

- [x] Deterministic time override works correctly
- [x] 24h hour `23` is matched and normalized to `11:00 م`
- [x] Immutable context preserved
- [x] Backward compatible
