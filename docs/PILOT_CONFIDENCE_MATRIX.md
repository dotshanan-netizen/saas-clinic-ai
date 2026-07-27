# Pilot Confidence Matrix

**Last Updated**: 26 Jul 2026  
**Phase**: Pre-Pilot Stabilization  
**Purpose**: Track which system layers are reliable enough for Pilot launch  

---

## Legend

| Icon | Meaning | Action Required |
|------|---------|----------------|
| 🟢 **High** | Verified stable | No action needed |
| 🟡 **Medium** | Under observation | E2E confirmation or minor fix pending |
| 🔴 **Low** | Needs investigation | Open bug or unverified behavior |

---

## The Matrix

| Layer | Owner | Can Read | Can Write | Confidence | Evidence | Last Verification |
|-------|-------|----------|-----------|------------|----------|-------------------|
| **Conversation Memory** | Conversation Engine | ✅ | ✅ | 🟢 **High** | 3 memory leaks closed (Merge Guard, Validation, Calendar) | Pass |
| **Validation** | Validation (`validateBookingData`) | ✅ | ❌ | 🟢 **High** | Principle: Validation ≠ Memory established | Pass |
| **Phone Validation** | `extractSaudiPhone` | ✅ | ❌ | 🟢 **High** | 10/10 tests, GCC whitelist enforced | Pass |
| **Dashboard Data** | Dashboard UI | ✅ | ❌ | 🟢 **High** | Mock messages replaced with real data | Pass |
| **Merge Guard** | Business Engine | ✅ | 🟡 | 🟢 **High** | Only protects existing values; fixed CI-041 | Pass |
| **Calendar Integration** | BookingService + Double Booking Guard | ✅ | ❌ | 🟡 **Medium** | E2E passed for "4 العصر" — needs more scenarios | Manual Test |
| **Intent Escalation** | Business Engine (PF-003) | ✅ | 🟡 | 🟡 **Medium** | Fix applied — escalated when AI provides availability | Pending E2E |
| **Booking Creation** | Business Engine (transaction) | ✅ | ✅ | 🟡 **Medium** | Works, but race condition load test pending | Pending E2E |
| **Time Parsing** | AI + TimeNormalizer | ✅ | ✅ | 🔴 **Low** | Bug 11→07 open — observable via logs | Unresolved |
| **Structured Logging** | All layers | ✅ | ✅ | 🟢 **High** | 6 trace points per request | Pass |

---

## 🟡 Missing: Multi-turn Conversation Flow Tests

**Observation**: All major bugs discovered involved state evolving across ≥3 messages.  
**Current coverage**: Unit Tests + Manual E2E. Gap: **Conversation Flow Tests**.

### Suggested test pyramid post-Pilot:

```
Unit Tests (single function)
         ↓
Conversation Flow Tests (3+ sequential messages)
         ↓
E2E Tests (WhatsApp → Server → Dashboard)
```

---

## 📋 Post-Pilot Roadmap — Sprint: "Conversation Reliability"

After Pilot launch, no new features. Only:

1. **Create Multi-turn Conversation Flow Tests**
   - Convert top 5 historical bugs into regression tests
   - Test sequences: "عاوزة احجز" → "فريال" → "4 العصر"
   - Test edge cases: time out of range, duplicate booking, takeover

2. **Stabilize Intent Escalation Rules**
   - Audit all escalation paths in BusinessEngine
   - Ensure PF-003 and AvailabilityInquiry are clearly separated

3. **Close Bug 11→07**
   - Await structured log capture
   - Apply fix based on evidence

4. **Formalize Layer Ownership**
   - Document Can Read / Can Write for every layer
   - Turn principles into automated linting rules

---

## Current Status

| Metric | Value |
|--------|-------|
| 🟢 High Confidence | 6 / 10 layers |
| 🟡 Medium Confidence | 3 / 10 layers |
| 🔴 Low Confidence | 1 / 10 layers |
| **Pilot Readiness** | **🟡 Limited Pilot Ready** |

---

## What Green Means

Each 🟢 layer has:
- ✅ A clear principle defining what it can and cannot do
- ✅ Evidence it works correctly (unit tests or E2E)
- ✅ No open bugs in that layer

## What Yellow Means

Each 🟡 layer has:
- ⏳ A known scenario that passed E2E but needs repetition
- ⏳ A fix applied but not yet confirmed via E2E
- ⏳ A pre-existing test failure unrelated to the layer

## What Red Means

Each 🔴 layer has:
- 🔴 An open, confirmed bug with unknown root cause
- 🔴 Under active observation via structured logging

---

## Escalation Path

When a bug appears in production:
1. Structured logs capture it (event + requestId + values)
2. Check the Confidence Matrix — which layer owns this?
3. If Confidence is 🟢: Investigate why the safeguard failed
4. If Confidence is 🟡: Confirm E2E, then promote to 🟢
5. If Confidence is 🔴: This is expected — apply fix based on evidence

---

**Matrix Owner**: Engineering Team  
**Update Frequency**: After each E2E scenario or bug fix  
**Goal**: All layers 🟢 before declaring Pilot Ready