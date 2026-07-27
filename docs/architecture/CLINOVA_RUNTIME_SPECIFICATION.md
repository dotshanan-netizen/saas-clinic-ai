# Clinova Runtime Specification

**Version**: 1.0  
**Effective**: 26 Jul 2026  
**Status**: 🟢 Active — derived from 6+ investigations and 4 architectural fixes  
**Purpose**: Define contracts between layers. Not how they work — what they own.

---

## 1. Architecture Overview

```
WhatsApp → Webhook → ConversationEngine → AIProvider → BusinessEngine → WhatsApp
                                ↕                    ↕           ↕
                           Database              Memory      Validation
                                                              ↕
                                                          Calendar
```

---

## 2. Layer Ownership Matrix

Every component owns exactly one thing. Writing outside ownership is a bug.

| Component           | Owns                          | Can Write                     | Can Read                    | Cannot Write               |
|---------------------|-------------------------------|-------------------------------|-----------------------------|----------------------------|
| **ConversationEngine** | Conversation Memory (History, CurrentState) | History, CurrentState, BookingData in DB | Conversation, Booking | ❌ Response content |
| **AIProvider**      | Intent + Draft Response        | AI Result (intent, response, bookingData) | Prompt context, History | ❌ Conversation Memory |
| **BusinessEngine**  | Final Decision                 | Final Response, Booking Creation | AI Result, Validation, Calendar | ❌ Conversation Memory (unless booking created) |
| **Validation**      | Validation Result Only         | `isValid`, `missingFields`    | Sanitized Input             | ❌ Memory, ❌ BookingData |
| **Calendar (BookingService)** | Availability Only    | `getAvailableSlots()` (slots list) | Doctor schedules, Bookings | ❌ Memory, ❌ Validation, ❌ Response |
| **TimeNormalizer**  | Time Canonicalization          | Normalized time string        | Raw user input              | ❌ Memory, ❌ Validation |

### Golden Rule

> **Every component can write ONLY to its Owned column. Writing to any other column is a bug.**

---

## 3. Data Contracts Between Layers

### 3.1 Webhook → ConversationEngine

```
Input:  { clinicSlug, clientPhone, message, source, wamid }
Output: { response, humanTakeover, bookingData, bookingCreated, intent, stage, policy }
```

**Contract**: Webhook NEVER modifies conversation state. It only passes data.

### 3.2 ConversationEngine → AIProvider

```
Input:  { clinic, history[], source, currentState{}, availableSlotsText, businessProfile }
Output: { response, intent, humanTakeover, requiresRag, bookingData{} }
```

**Contract**: AIProvider receives context, returns AI judgment. Never writes to DB.

### 3.3 ConversationEngine → BusinessEngine

```
Input:  { clinic, clientPhone, userMessage, aiResult{}, source, currentState{} }
Output: { finalResponse, bookingCreated, bookingModified, modifiedBookingData{}, resolvedIntent }
```

**Contract**: BusinessEngine makes the final decision. Returns what to say and whether to book. Does NOT modify ConversationEngine's state (no `modifiedBookingData.* = null` outside its ownership).

### 3.4 BusinessEngine → Validation

```
Input:  { data{}, fallbackPhone, clinic, previousTimeSlot }
Output: { isValid, missingFields[], normalizedPhone, cleanTimeSlot, ... }
```

**Contract**: Validation returns pass/fail + normalized values. Does NOT change input data. Does NOT modify Memory.

### 3.5 BusinessEngine → Calendar (BookingService)

```
Input:  { clinicId, doctorName, serviceName? }
Output: { Record<string, string[]> } — slots available per day
```

**Contract**: Calendar is pure read. Returns available slots. Does NOT modify BookingData or Memory.

---

## 4. State Lifecycle

Each piece of booking data goes through exactly 4 phases:

### Phase 1: Creation

| Field | Creator | When |
|-------|---------|------|
| `clientName` | AIProvider (extraction) | Any message containing a name |
| `clientPhone` | AIProvider OR BusinessEngine (fallback) | Any message |
| `serviceName` | AIProvider (extraction) | Any message mentioning a service |
| `doctorName` | AIProvider (extraction) | Any message mentioning a doctor |
| `branchName` | AIProvider (extraction) | Any message mentioning a branch |
| `timeSlot` | AIProvider (extraction) → TimeNormalizer | Any message mentioning a time |

### Phase 2: Storage

All fields are stored in Conversation Memory (History).

**Storage rules**:
- ✅ Stored via `modifiedBookingData` → assistant message's `bookingData`
- ✅ Only new values overwrite old ones
- ❌ Validation does NOT clear stored values
- ❌ Calendar does NOT modify stored values  
- ❌ Merge Guard does NOT prevent first extraction

### Phase 3: Validation

Validation reads from Memory, returns pass/fail.

**Validation rules**:
- ✅ Returns `isValid` + `missingFields[]`
- ✅ Canonicalizes (normalizes) values
- ❌ Does NOT modify Memory

### Phase 4: Canonicalization

For time slots specifically, the slot string from Calendar replaces the user's raw time.

**Canonicalization rules**:
- ✅ `validation.cleanTimeSlot = slot` (replace with canonical slot string)
- ❌ `modifiedBookingData.timeSlot = slot` (does NOT update Memory)

---

## 5. Intent Classification Rules

### 5.1 Intent Priority

```
HumanTakeover (highest priority)
    ↓ CancelAppointment
    ↓ ModifyBooking
    ↓ BookAppointment
    ↓ Objection
    ↓ Complaint
    ↓ Inquiry
    ↓ Unknown (lowest priority)
```

### 5.2 Escalation Rules

| From | To | Condition | Authority |
|------|----|-----------|-----------|
| Unknown | Inquiry | Default fallback | BusinessEngine |
| Unknown | BookAppointment | If `userMessage` matches booking patterns | BusinessEngine |
| Inquiry | BookAppointment | If service extracted AND AI did NOT respond with availability info | BusinessEngine |
| Inquiry | BookAppointment | If in booking context + short time update | BusinessEngine |
| Inquiry | (kept as Inquiry) | If AI response contains time slot patterns (`\d{1,2}:\d{2}\s+[صم]`) | BusinessEngine |

### 5.3 Escalation Forbidden

- ❌ NEVER escalate Inquiry to BookAppointment if the AI already provided available times
- ❌ NEVER escalate HumanTakeover to any other intent
- ❌ NEVER escalate CancelAppointment to BookAppointment

---

## 6. Conversation Flow (Booking Path)

```
Step 1: Greeting
        Required: nothing
        Next: collect service OR answer question
        Owner: ConversationEngine (via AI)

Step 2: Service Selection
        Required: serviceName
        Blockers: serviceName missing
        Next: doctor (if multiple) OR branch OR time
        Owner: ConversationEngine (via AI)

Step 3: Doctor Selection
        Required: doctorName (or "أي طبيب")
        Blockers: multiple doctors for service
        Next: branch OR time
        Owner: ConversationEngine (via AI)

Step 4: Branch Selection
        Required: branchName
        Blockers: branchName missing
        Next: time
        Owner: ConversationEngine (via AI)

Step 5: Time Selection
        Required: timeSlot
        Blockers: timeSlot missing, slot unavailable
        Next: confirmation
        Owner: Validation + Calendar + BusinessEngine

Step 6: Confirmation
        Required: all 5 fields
        Output: Booking created in DB
        Owner: BusinessEngine (transaction)
```

### Flow Rules

- ✅ User can skip steps (mention service + branch + time in one message)
- ✅ User can ask about availability mid-flow (Inquiry preserved)
- ❌ User asking about availability should NOT reset the flow
- ❌ Validation failing should NOT clear collected data

---

## 7. Error Classification

Every error should be classified into exactly one category:

| Category | Examples | Action |
|----------|----------|--------|
| **Pipeline** | Request timeout, crash, missing env | Fix infrastructure |
| **Memory** | State leak, wrong currentState | Fix ownership |
| **Intent** | Wrong escalation, wrong classification | Fix escalation rules |
| **Validation** | Wrong missingFields, false pass | Fix validation logic |
| **Calendar** | Wrong availability, wrong matching | Fix booking service |
| **Database** | Schema, constraint, migration | Fix schema |
| **AI** | Wrong extraction, hallucination | Fix prompt or extraction rules |
| **Frontend** | Wrong display, missing data | Fix UI |

---

## 8. Logging Requirements

Every architectural decision point MUST emit a structured log:

| Decision Point | Event Name | What It Logs |
|---------------|------------|--------------|
| AI returns | `[DEBUG AIResult]` | Full AI JSON |
| Entity extraction | `ENTITY_EXTRACTION` | extracted + aiRaw + currentState |
| After merge guard | `PRE_VALIDATION` | finalSanitized values |
| Time normalization | `[TimeNormalizer]` | raw → normalized |
| Validation result | `VALIDATION_RESULT` | isValid, missingFields, cleanTimeSlot |
| Double booking check | `DOUBLE_BOOKING_GUARD_CHECK` | searchTime, slot count |
| Double booking match | `DOUBLE_BOOKING_GUARD_MATCH` | matched slot, matchType |
| Double booking failure | `DOUBLE_BOOKING_GUARD_NO_SLOT` | searched time |
| Pipeline complete | `PIPELINE_RESULT` | response, timeSlot, bookingCreated, intent |

**Rule**: Any new decision point MUST add a log entry. No silent decisions.

---

## 9. Regression Test Requirements

Every bug fix MUST produce a regression test:

| Bug | Test Type | Status |
|-----|-----------|--------|
| Phone Validation (regex fallback) | ✅ Unit Test | Pass (10/10) |
| Merge Guard (state loss) | ❌ Missing | 🟡 Post-Pilot |
| Validation ≠ Memory (service clearance) | ❌ Missing | 🟡 Post-Pilot |
| Calendar ≠ Memory (timeSlot modification) | ❌ Missing | 🟡 Post-Pilot |
| Intent Escalation (availability question) | ❌ Missing | 🟡 Post-Pilot |
| Bug 11→07 | ❌ Missing | 🔴 Open |

**Rule**: No fix is complete until a Conversation Flow Test covers it.

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 26 Jul 2026 | Initial specification after 4 architectural fixes |

---

**This document is the single source of truth for Clinova runtime contracts. Any code that violates it is a bug by definition, not by opinion.**

**Author**: Engineering Team (derived from investigations 26 Jul 2026)  
**Review Cycle**: Every 2 weeks or after any architectural change  
**Status**: 🟢 Active