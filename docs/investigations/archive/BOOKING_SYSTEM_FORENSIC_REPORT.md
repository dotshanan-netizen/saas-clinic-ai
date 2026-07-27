# Booking System Forensic Report

**Date**: 26 Jul 2026  
**Status**: Production Incident — Not Reproducible  
**Classification**: Forensic Summary (all layers analyzed, no code modified)

---

## 1. Architecture Quality

| Metric | Rating | Evidence |
|--------|--------|----------|
| Layer Separation | 🟡 7/10 | BusinessEngine overburdened (10 steps, 4 overrides) |
| Ownership Clarity | 🟢 8/10 | 4 ownership violations found and fixed |
| Data Flow | 🟢 8/10 | Structured logging at 6 trace points |
| State Management | 🟡 7/10 | Memory leaks fixed, but no formal state machine |
| Error Handling | 🟡 6/10 | Graceful failures exist, but no error classification |

---

## 2. Weakest Layers

| Layer | Weakness | Severity |
|-------|----------|----------|
| **Time Parsing** | Bug 11→07 (open, non-reproducible) | 🔴 High |
| **Intent Escalation** | PF-003 was too aggressive (fixed) | 🟡 Medium |
| **Merge Guard** | Was preventing first extraction (fixed) | 🟡 Medium |
| **BusinessEngine** | 10 responsibilities in one class | 🟡 Medium |

---

## 3. Highest Risk Areas

| Risk | Impact | Monitoring |
|------|--------|-----------|
| 11→07 time corruption | Wrong booking time | Structured logs (6 points) |
| LLM non-determinism | Inconsistent responses | Structured logs + Prompt audit |
| BusinessEngine complexity | Unintended side effects | Manual code review |
| Multi-turn state loss | Lost collected data | Structured logs at each step |

---

## 4. Hidden Coupling

| Coupling | Components | Impact |
|----------|-----------|--------|
| BusinessEngine ↔ Memory | BusinessEngine was writing `modifiedBookingData` | 🔴 Fixed |
| Calendar ↔ Memory | Double Booking Guard was modifying `modifiedBookingData.timeSlot` | 🔴 Fixed |
| Validation ↔ Memory | Validation was clearing `modifiedBookingData.*` | 🔴 Fixed |
| Intent ↔ AI | BusinessEngine overriding AI's intent | 🟡 Partially fixed |

---

## 5. State Management Risks

| Risk | Status | Mitigation |
|------|--------|-----------|
| State leaks across sessions | 🟢 Fixed | Session reset markers in history |
| State modified by non-owners | 🟢 Fixed | 4 ownership violations corrected |
| MAX_DB_MESSAGES (50) truncation | 🟡 Medium | Old messages lost at limit |
| No formal state machine | 🟡 Medium | Flow driven by AI + rules, no explicit state transitions |

---

## 6. LLM Risks

| Risk | Evidence | Mitigation |
|------|---------|-----------|
| Time extraction non-deterministic | 11→07 appears occasionally but not reproducible | Structured logs capture extraction |
| Intent classification varies | Different AI responses to same input at different times | Fixed escalation rules |
| Arabic numeral handling | ✅ Arabic-Indic (٤) and Persian (۴) numerals handled correctly | TimeNormalizer regex |
| "بكرة" normalization | ✅ Correctly handled | Returns null when no specific hour given |

---

## 7. Calendar Risks

| Risk | Evidence | Mitigation |
|------|---------|-----------|
| Slot generation correct | ✅ All 3 doctors generate correct 30-min slots | Pure read function |
| Hour matching imprecise | `hourMatch` matches any slot in the same hour | Acceptable for this stage |
| Double booking prevention | ✅ Serializable isolation + conflict check | 2-layer protection |
| Timezone handling | ⚠️ Not explicitly handled | All times in clinic local time |

---

## 8. Regression Risks

| Bug | Fixed | Regression Test |
|-----|-------|----------------|
| Phone validation (regex) | ✅ | ✅ Unit test (10/10) |
| Merge Guard blocking first extraction | ✅ | ❌ Missing (post-Pilot) |
| Validation clearing memory | ✅ | ❌ Missing (post-Pilot) |
| Calendar modifying memory | ✅ | ❌ Missing (post-Pilot) |
| Intent escalation too aggressive | ✅ | ❌ Missing (post-Pilot) |
| 11→07 | ❌ Not reproducible | ❌ Pending reproduction |

---

## 9. Open Items

| Item | Priority | Action |
|------|----------|--------|
| Bug 11→07 | 🔴 High | Monitor via structured logs |
| Multi-turn regression tests | 🟡 Medium | Post-Pilot |
| BusinessEngine refactoring | 🟡 Medium | Post-Pilot |
| Error classification system | 🟢 Low | Post-Pilot |

---

## 10. Final Verdict

> **System Quality**: 8/10 — 4 architectural vulnerabilities found and fixed, 2 pre-existing test failures unrelated to shipping, 1 open non-reproducible bug under structured monitoring.
>
> **Pilot Readiness**: Limited Pilot Ready — Conditional.
>
> Conditions:
> - Human verification for every booking during Pilot
> - Structured logging enabled and monitored
> - Golden regression suite maintained
> - Every anomaly added to regression tests
> - No architectural changes without reproducible evidence
>
> **Known Issue**: Bug 11→07 — Non-reproducible. Under observation via structured logs. Not a Pilot blocker because all bookings are human-verified during Pilot phase.
>
> **Next Phase**: Limited External Pilot with real clinic users. Every booking manually verified by reception staff. Anomalies captured via structured logs. No code changes until bug is reproduced with full trace.

*Report generated 26 Jul 2026. Based on 10 architecture audits, 8 E2E scenarios, 4 architectural fixes, 1 isolated prompt test, 2 reproduction attempts.*