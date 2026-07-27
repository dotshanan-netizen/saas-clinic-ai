# Release Manifest — pilot-candidate-1

**Release Tag**: `pilot-candidate-1`
**Commit SHA**: `c259d977fa75afc1b84c42c019d577f161799e8c`

---

## Modified Files

| File | Purpose | Category |
|------|---------|----------|
| `BusinessEngine.ts` | Merge Guard: add `currentState.X &&` condition | Bug Fix |
| `BusinessEngine.ts` | Validation ≠ Memory: remove `modifiedBookingData.* = null` | Bug Fix |
| `BusinessEngine.ts` | Calendar ≠ Memory: remove `modifiedBookingData.timeSlot = slot/null` from Double Booking Guard | Bug Fix |
| `BusinessEngine.ts` | Intent Escalation: add `!aiProvidedAvailability` check | Bug Fix |
| `BusinessEngine.ts` | Structured logging: `DOUBLE_BOOKING_GUARD_CHECK/MATCH/NO_SLOT` | Observability |
| `ConversationEngine.ts` | Structured logging: `PIPELINE_RESULT` event | Observability |
| `conversations/route.ts` | Add `lastMessage` field to API response | Bug Fix |
| `dashboard/page.tsx` | Replace mock messages with real `lastMessage` | Bug Fix |
| `CLINOVA_RUNTIME_SPECIFICATION.md` | New: layer ownership, contracts, state lifecycle | Documentation |
| `PILOT_CONFIDENCE_MATRIX.md` | New: confidence tracking per layer | Documentation |
| `ENGINEERING_REVIEW_PROTOCOL.md` | New: formal review framework | Documentation |

---

## Risk Assessment

| Change | Runtime Change | DB Impact | AI Change | Booking Change | UI Change |
|--------|---------------|-----------|-----------|---------------|-----------|
| Merge Guard fix | YES | NO | NO | YES — affects when state is preserved | NO |
| Validation ≠ Memory | YES | NO | NO | YES — prevents state loss | NO |
| Calendar ≠ Memory | YES | NO | NO | YES — prevents memory corruption | NO |
| Intent Escalation fix | YES | NO | YES — prevents AI response override | YES — availability questions now work | NO |
| Structured logging | YES | NO | NO | NO | NO |
| Dashboard lastMessage | YES | NO | NO | NO | YES — shows real message |

---

## Release Objective

**A. Observability Deployment**

All 4 bug fixes are architectural corrections that restore intended behavior (fix ownership violations). The primary objective is deploying structured logging to capture production runtime evidence for Incident A (11→07).

---

## Deployment Verification

| Item | Expected | Verified |
|------|----------|----------|
| Commit SHA | `c259d97` | Pending |
| Git Tag | `pilot-candidate-1` | Pending |
| Structured Logging | 6 trace points active | Pending |
| Environment | Production (Vercel) | Pending |

---

## Incident Capture Protocol

If Incident A (11→07) or Incident B (11→11 unavailable) occurs after deployment:

1. Capture conversation transcript
2. Extract runtime trace from production logs
3. Record build SHA and deployment version
4. Save AI extraction, normalized time, calendar request/response, Business Engine decision
5. **Do not investigate** — capture evidence only

**Investigation Gate**: No investigation may begin until all artifacts above are captured. If any artifact is missing, mark the incident `Evidence Incomplete` and stop.

---

## Pilot Gate

Do not declare Pilot Ready until ALL conditions satisfied:

- [ ] Production deployment verified
- [ ] Structured logging verified active
- [ ] Incident A resolved OR root cause proven
- [ ] Incident B resolved OR root cause proven
- [ ] Regression suite passed
- [ ] Release evidence documented

---

## Investigation Rule

> Runtime Evidence from Production only. No repository assumptions. No merging incidents without evidence.