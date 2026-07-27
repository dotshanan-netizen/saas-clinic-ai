# Golden Test Plan — Booking Pipeline Regression Suite

## Purpose

Permanent regression suite using real conversation patterns. Every bug found becomes a test. No fake data.

---

## Test Format

Each test is a script that:
1. Creates a unique phone number
2. Sends sequential messages via `ConversationEngine.processMessage()`
3. Asserts specific conditions at each step
4. Verifies final database state

---

## Test 001: Happy Path — Full Booking

**Source**: Production working conversation  
**Messages**:
```
عاوزة احجز تنظيف بشرة
اسمي فريال
فرع الصحافة
بكرة الساعة 11 صباح
```
**Asserts**:
- [ ] Booking created in DB
- [ ] Service = "تنظيف البشرة العميق"
- [ ] Branch = "فرع الصحافة"
- [ ] Time = Monday 27 Jul 11:00
- [ ] Status = PENDING

---

## Test 002: Memory Across Messages

**Source**: E2E-002 scenario  
**Messages**: 7 messages (service → name → branch → doctor → time)  
**Asserts**:
- [ ] Service name survives all 7 messages
- [ ] No field changes to null after being set

---

## Test 003: Doctor Not Found

**Source**: E2E-005 scenario  
**Messages**:
```
عايزة أحجز مع الدكتورة سارة
```
**Asserts**:
- [ ] No crash
- [ ] No booking created
- [ ] AI response acknowledges doctor not found

---

## Test 004: Service Not Found

**Source**: E2E-006 scenario  
**Messages**:
```
عايزة خدمة غير موجودة
```
**Asserts**:
- [ ] No crash
- [ ] No booking created
- [ ] Graceful fallback response

---

## Test 005: Availability Inquiry (No Escalation)

**Source**: E2E-003 + PF-003 fix verification  
**Messages**:
```
إيه المواعيد المتاحة بكرة؟
```
**Asserts**:
- [ ] Intent remains Inquiry (not escalated to Booking)
- [ ] No booking created

---

## Test 006: Arabic-Indic Numerals

**Source**: Production user input  
**Messages**:
```
٤ العصر
```
**Asserts**:
- [ ] TimeNormalizer converts ٤ to 4
- [ ] cleanTimeSlot = "04:00 م"

---

## Test 007: بكرة Without Time

**Source**: Production pattern  
**Messages**: `"بكرة"`  
**Asserts**:
- [ ] TimeNormalizer returns null (no specific hour)
- [ ] Validation shows time missing
- [ ] No crash

---

## Test 008: Merge Guard — First Extraction

**Source**: CI-041 (Merge Guard fix)  
**Messages**:
```
عاوزة احجز تنظيف بشرة
اسمي فريال
```
**Asserts**:
- [ ] Step 1: serviceName = "تنظيف البشرة العميق"
- [ ] Step 2: serviceName still = "تنظيف البشرة العميق"

---

## Test 009: Calendar ≠ Memory

**Source**: Calendar Ownership fix  
**Scenario**: Book a time, have it be unavailable, then check state in next message  
**Asserts**:
- [ ] `modifiedBookingData.timeSlot` is NOT modified by calendar
- [ ] User's original requested time preserved in history

---

## Test 010: Double Booking Prevention

**Source**: E2E-007 scenario  
**Scenario**: Create same booking twice  
**Asserts**:
- [ ] First booking succeeds
- [ ] Second booking fails gracefully
- [ ] Only 1 booking in database

---

## Future Tests

Each new bug discovered during Pilot must follow the same format and be added to this suite before the fix is merged.

| Bug | Test Added | Status |
|-----|-----------|--------|
| 11→07 | When captured with structured logs | ⏳ Pending |
| (future) | — | — |