# Pilot End-to-End Validation Plan

This document establishes the official directive and execution boundaries for the **Pilot End-to-End Validation** phase of Clinova. No conversation polish, wording changes, or dialogue refinements are permitted during this phase unless they directly block the booking lifecycle.

---

## 🎯 Validation Goals

We must validate the complete runtime path:
```text
WhatsApp Cloud API
      ↓
Conversation Engine (Context Extraction)
      ↓
Business Engine (Validation Guards)
      ↓
Scheduling Engine (Calendar & Work Hours)
      ↓
Booking Creation (Serializable Transactions)
      ↓
Dashboard (Real-time polling)
      ↓
Receptionist Actions (Confirm / Modify / Cancel)
      ↓
Patient Confirmation (Outbound Notification)
```

---

## 📅 Scheduling Engine Scenarios to Verify

The scheduling engine must be tested against realistic calendar database states:
* **Available Days:** Standard slots generated correctly.
* **Fully Booked Days:** Slot lists are empty or correctly blocked.
* **Doctor Holidays:** Holiday records (`isClosed: true`) successfully exclude the day.
* **Branch Working Hours:** No slots generated outside active branch timing.
* **Multiple Doctors:** Services mapped to multiple doctors prompt for preference or accept `ANY`.
* **Single Doctor Services:** Services mapped to one doctor auto-resolve the doctor.
* **ANY Doctor Scheduling:** Union of doctor schedules is generated, and dynamic assignment is performed on booking.
* **Overlapping Bookings:** Prevention of double-booking under serializable transaction isolation.

---

## 📋 Required Production Test Cases

Before declaring the milestone complete, verify:
1. **Creation:** Booking is successfully created from a WhatsApp session.
2. **Dashboard Delivery:** The booking instantly appears in the receptionist Dashboard.
3. **Context Association:** The booking is correctly linked to the active `Conversation` record.
4. **AI Summary:** The receptionist view displays the generated AI context summary.
5. **Staff Control:** Receptionist can review, confirm, or modify the booking from the Dashboard.
6. **Outbound Notification:** Patient receives the updated confirmation status message back on WhatsApp.

---

## 🗄️ Conversation Backlog (Postponed Tasks)

Dialogue and phrasing issues are recorded here and **must not** be worked on during this milestone:
* Question ordering improvements.
* Response wording and translation checks.
* Natural language understanding of relative dates (e.g., "بكرة").
* Natural language understanding of meridiem indicators (e.g., "ص" or "م").
* "First available slot" wording and selection flow.
* AI agent tone and style modifications.

---

## 🏆 Success Criteria

This milestone is considered fully complete and ready for Pilot launch when:
* **End-to-End booking flow** is 100% reliable under production workloads.
* **Scheduling decisions** (availability, assignments) are mathematically correct.
* **Dashboard state transitions** (takeover, confirm, edit) update instantly.
* **No blocking production bugs** remain in the core pipeline.
