# Booking Incidents — Separation of Records

## Incident A (11→07)

**Status**: Non-Reproducible

| Field | Value |
|-------|-------|
| User message | `"بكرة الساعة 11 صباح"` / `"الصباح الساعة 11 بكرة"` |
| User requested | **11:00 AM** |
| System replied | **07:00 AM unavailable** |
| Occurrences | Multiple production conversations (2:12 PM, 6:04 PM) |
| Reproduced in test | ❌ 0/10 attempts, 0/3 isolated prompt tests |
| Suspected layer | LLM extraction (non-deterministic) — not confirmed |
| Structured logging at time | ❌ Not deployed to production |
| Closing criteria | Failing runtime trace captured OR verified root cause explains 11→07 |

---

## Incident B (11→11 Unavailable)

**Status**: Reproducible

| Field | Value |
|-------|-------|
| User message | `"بكرة الساعة 11 صباح"` |
| User requested | **11:00 AM** |
| System replied | **11:00 AM unavailable** |
| Occurrences | Local reproduction run #10 (after 9 bookings filled the slot) |
| Root cause | Slot genuinely filled by previous bookings (test or real) |
| Structured logging at time | ✅ Captured: `DOUBLE_BOOKING_GUARD_NO_SLOT` |
| Closing criteria | Database evidence confirms slot availability at incident timestamp |

---

## Investigation Rules (Going Forward)

1. No conclusions without runtime evidence.
2. No root cause without a failing trace.
3. No architectural fix without identified responsible layer.
4. Every production incident receives its own ID.
5. Similar symptoms must not be merged automatically.

---

## Deployment Status

| Item | Repository | Production |
|------|-----------|------------|
| Git tag | `pilot-candidate-1` | Unknown |
| Commit SHA | `c259d97` | Unknown |
| Structured logging | ✅ Implemented | ❌ Not deployed |
| 4 architectural fixes | ✅ Implemented | ❌ Not deployed |

**Production deployment cannot be verified from this environment** (no Vercel CLI access).

---

## Pilot Readiness

**Suspended** until:
1. Production observability verified (structured logs deployed and active)
2. Incident A status resolved or understood
3. Incident B status resolved or understood

Reverify with `PRODUCTION_VERIFICATION.md` after deployment.