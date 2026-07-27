# 📑 Centralized Pilot Observation Log & Validation Register (PILOT_FINDINGS.md)

## 📌 Purpose & Governance
This document serves as the official **Bug & Validation Register** for live WhatsApp Pilot testing. All runtime anomalies, dialogue loops, and UX frictions observed in production are logged, categorized, and resolved through a strict lifecycle:

```text
Observation ➔ Root Cause Analysis ➔ Architectural Policy Check ➔ Fix ➔ Regression Test ➔ Closed
```

### 🔒 Core Governance Rules
1. **Architectural Gap vs Implementation Bug:** Before fixing any finding, evaluate: Is this an implementation bug OR an architectural gap/ambiguity in policy? If an architectural gap exists, update the master Architecture Document FIRST before writing any code.
2. **Regression Testing Requirement:** Every closed finding MUST have a verified automated regression test.

---

## 🧭 Categories Index
- [1. Runtime & Identity Issues](#-1-runtime--identity-issues)
- [2. Conversation & AI Dialogue Issues](#-2-conversation--ai-dialogue-issues)
- [3. Booking & Scheduling Engine Issues](#-3-booking--scheduling-engine-issues)
- [4. Reception Dashboard Issues](#-4-reception-dashboard-issues)
- [5. Infrastructure & Performance Issues](#-5-infrastructure--performance-issues)
- [6. User Experience (UX) Issues](#-6-user-experience-ux-issues)

---

## ⚡ 1. Runtime & Identity Issues

### 🚨 PF-001: Redundant Phone Number Validation in WhatsApp Chat
- **Priority:** P0 (Critical)
- **Status:** Verified ✅ (Closed)
- **Business Impact:** High
- **User Impact:** Moderate
- **Root Cause Category:** `Identity` / `Validation`
- **Detected In:** Live Pilot (WhatsApp Production)
- **Affected Component:** `ConversationEngine` / `BusinessEngine` / `types.ts`
- **Observed Behavior:** During a WhatsApp chat where the E.164 sender phone is already authenticated, after providing date/time ("بكره الساعة 5"), the assistant requested: *"الرجاء تزويدنا برقم تواصل صحيح..."*.
- **Expected Behavior:** WhatsApp sender E.164 phone is the canonical client identity per `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md`. System must auto-attach sender phone without prompting unless client explicitly provides an alternative number.
- **Root Cause:** Two-part bug: (1) `extractSaudiPhone` in `types.ts` rejected all non-GCC numbers regardless of source, rejecting canonical WhatsApp E.164 sender numbers (`+20...`, `+971...`). (2) The WhatsApp bypass code in `validateBookingData` was placed in the `else` branch (line 232) which only executes when `phone` is already truthy, but `extractSaudiPhone` returned `null` for non-GCC numbers, so the bypass never ran. The fix in `BusinessEngine.ts` (auto-injection of sender phone) correctly pulled the WhatsApp sender E.164 into `extractedPhone`, but `validateBookingData` then fed it through `extractSaudiPhone` which rejected it again.
- **Architectural Policy Reference:** `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` (Section 2 - Customer Identity) and `PROJECT_IDENTITY.md` (§6 — conflict documentation protocol).
- **Regression Test:** `src/__tests__/unit/pilot_stabilization_sprint.test.ts` (`PF-001: should NOT trigger phone prompt or country restriction for international WhatsApp senders`).
- **Evidence:** Production WhatsApp Transcript & Live Pilot Log (`+20...` sender test).
- **Fixed In:** `src/lib/domain/types.ts` — `validateBookingData` now checks `data.source === "WhatsApp"` BEFORE calling `extractSaudiPhone`. For WhatsApp sources, it attempts normalization via `extractSaudiPhone` for format consistency, but falls back to the raw E.164 sender number if `extractSaudiPhone` rejects it (non-GCC country). `BusinessEngine.ts` auto-injection unchanged.
- **Verified By:** Automated Vitest Regression Test Suite (`52/53 passing` — PF-001 ✅, only pre-existing race condition fixture failure).

---

## 💬 2. Conversation & AI Dialogue Issues

### 🚨 PF-003: Service Selection Dialogue Loop
- **Priority:** P0 (Critical)
- **Status:** Verified ✅ (Closed)
- **Business Impact:** High
- **User Impact:** Critical
- **Root Cause Category:** `Dialogue Management` / `Runtime State`
- **Detected In:** Live Pilot (WhatsApp Production)
- **Affected Component:** `ConversationEngine` / `BusinessEngine`
- **Observed Behavior:** Client inquired about offers -> Assistant replied -> Client specified service: `"ليزر إزالة شعر"`. Assistant repeated *"وش الخدمة أو الجلسة اللي حابة تحجزيها؟"*. Client repeated `"ليزر إزالة شعر"`, assistant repeated the same prompt.
- **Expected Behavior:** Specifying a service (e.g., `"ليزر إزالة شعر"`) must transition dialogue state from inquiry to booking flow (`BookAppointment`) and prompt for branch/doctor/time.
- **Root Cause:** Service matching extracted the service name, but `aiResult.intent` remained `Inquiry`, causing `BusinessEngine` to treat it as a general inquiry and loop the prompt.
- **Architectural Policy Reference:** `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` (Section 3 - Conversation Lifecycle).
- **Regression Test:** `src/__tests__/unit/pilot_stabilization_sprint.test.ts` (`PF-003: should upgrade intent to BookAppointment`).
- **Evidence:** Live WhatsApp Transcript Log.
- **Fixed In:** `BusinessEngine.ts` (Intent escalation when `extractedService` is identified).
- **Verified By:** Automated Vitest Regression Test Suite (`31/31 passed`).

---

### 🚨 PF-004: Composite Single-Message Multi-Entity Extraction Failure
- **Priority:** P0 (Critical)
- **Status:** Verified ✅ (Closed)
- **Business Impact:** High
- **User Impact:** Critical
- **Root Cause Category:** `AI Prompt` / `Validation` / `Entity Extraction`
- **Detected In:** Live Pilot (WhatsApp Production)
- **Affected Component:** `BusinessEngine` / `AIProvider`
- **Observed Behavior:** Customer sent a multi-entity single message: *"اسمي فريال عاوزة تحجز ليزر إزالة شعر عند دكتورة سحر"*. The message contained 3 clear entities (Name: `فريال`, Service: `ليزر إزالة شعر`, Doctor: `سحر`), but assistant re-asked *"وش الخدمة أو الجلسة اللي حابة تحجزيها؟"*.
- **Expected Behavior:** All 3 entities (`clientName: "فريال"`, `serviceName: "ليزر إزالة شعر"`, `doctorName: "د. سحر"`) must be extracted simultaneously and stored in `currentState`, advancing directly to branch/time selection.
- **Root Cause:** Name extraction regex in `BusinessEngine.ts` only checked `/باسم/` and `/الاسم/` (missing `/اسمي/`), and `normalizeToOfficial` failed fuzzy matching for `"دكتورة سحر"` against `"د. سحر"`.
- **Architectural Policy Reference:** `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` (Section 5 - Customer Memory Policy).
- **Regression Test:** `src/__tests__/unit/pilot_stabilization_sprint.test.ts` (`PF-004: should extract Name, Service, and Doctor simultaneously from composite message`).
- **Evidence:** Live WhatsApp Transcript.
- **Fixed In:** `BusinessEngine.ts` (Title-stripping fuzzy match & expanded name regex).
- **Verified By:** Automated Vitest Regression Test Suite (`31/31 passed`).

---

## 📅 3. Booking & Scheduling Engine Issues

### 🚨 PF-002: Available Slot Display vs Selection Mismatch
- **Priority:** P0 (Critical)
- **Status:** Verified ✅ (Closed)
- **Business Impact:** High
- **User Impact:** Critical
- **Root Cause Category:** `Validation` / `TimeNormalizer` / `BookingService`
- **Detected In:** Live Pilot (WhatsApp Production)
- **Affected Component:** `TimeNormalizer` / `BookingService` / `BusinessEngine`
- **Observed Behavior:** Assistant displayed available slots: `09:00, 09:30, 10:00, ..., 04:30`. Customer typed `"9"`, assistant replied `"غير متاح"`. Customer typed `"10"`, assistant replied `"غير متاح"`.
- **Expected Behavior:** The presented available slots list (`availableSlots`) is the SINGLE SOURCE OF TRUTH. Any user selection matching a displayed hour (e.g. `"9"`, `"10"`) MUST be resolved against the offered slots list.
- **Root Cause:** `TimeNormalizer` normalized `"9"` to `"09:00 ص"` (AM) by default, while `availableSlots` contained `"09:00 م"` (PM). During double booking guard, `cleanTimeSlot` hour was not matched against the offered slots list. Also, `"12"` defaulted to midnight AM instead of noon PM.
- **Architectural Policy Reference:** `CANONICAL_TIME_SLOT_CONTRACT.md` (Section 2 - Layer Responsibilities).
- **Regression Test:** `src/__tests__/unit/pilot_stabilization_sprint.test.ts` (`PF-002: should resolve typos like 'السعة 6' and colloquial 'صباحي 12' to 12 PM noon`).
- **Evidence:** Production Log Transcript (`task-253.log`) & Live WhatsApp Test.
- **Fixed In:** `TimeNormalizer.ts` (Typo fixes `السعة` -> `الساعة`, 12 PM noon default) & `BusinessEngine.ts` (Hour matching against `availableSlots`).
- **Verified By:** Automated Vitest Regression Test Suite (`31/31 passed`).

---

## 🖥️ 4. Reception Dashboard Issues
*(No active issues logged)*

---

## ⚡ 5. Infrastructure & Performance Issues
*(No active issues logged)*

---

## 🎨 6. User Experience (UX) Issues
*(No active issues logged)*
