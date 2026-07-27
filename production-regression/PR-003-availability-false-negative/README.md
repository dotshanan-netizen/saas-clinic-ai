# PR-003: Availability False Negative

| Field          | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Incident ID**   | PR-003                                                             |
| **Incident Name** | availability-false-negative                                        |
| **Status**        | BLOCKED                                                            |
| **Level**         | 1 (BusinessEngine Replay)                                          |
| **Root Cause**    | BUG-B3: TimeNormalizer AM/PM heuristic misclassifies bare hours    |
| **Fix**           | D+B: Deterministic + Bayesian (approved, deferred)                 |
| **Bug Doc**       | `docs/investigations/PHASE_A_ROOT_CAUSE.md` (B3 section)           |
| **Fixture**       | `production-regression/PR-003-availability-false-negative/fixture.ts` |

## Description

When a user says "الساعة 10" without an explicit AM/PM indicator
(ص/م/صباحاً/مساءً), the TimeNormalizer heuristic defaults to AM.
For users who intend a PM time (e.g., 10 PM), the heuristic causes
a false negative in the slot availability check — the system looks
for 10:00 ص when the user meant 10:00 م.

The B3 fix ("D+B" approach) was approved by CTO but implementation
was deferred. It proposes:
1. **Deterministic first**: explicit ص/م indicators always win
2. **Bayesian fallback**: use time-of-day priors from clinic schedules
   to infer AM/PM for bare hours

## Current Status

**BLOCKED** — no implementation started. This fixture exists to ensure
that when B3 is eventually implemented, it has a permanent regression
test proving correct AM/PM resolution for ambiguous times.

## Replay Steps (Placeholder)

1. User says "أبغى أحجز بوتكس الساعة 10"
   - Current: timeSlot = "10:00 ص" (heuristic default)
   - Expected (post-B3): timeSlot determined by Bayesian priors

## Verification

- [ ] B3 fix implemented
- [ ] Ambiguous bare hour resolved with correct AM/PM
- [ ] No false negatives in slot availability
- [ ] Existing B1/B2 regressions still pass
