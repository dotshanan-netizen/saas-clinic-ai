# Runtime Verification Handoff Package — Antigravity

**Prepared by**: Repository & Product Authority  
**Prepared for**: Antigravity — Runtime & Production Verification Authority  
**Date**: 26 Jul 2026  
**Purpose**: This document is the sole input for Antigravity runtime verification. It contains only runtime-verifiable items. No code review, no implementation review, no repository checks.

---

## 1. Repository Identity

| Property | Value |
|----------|-------|
| **Commit Hash** | `c259d977fa75afc1b84c42c019d577f161799e8c` |
| **Branch** | `main` |
| **Vercel Project ID** | `prj_aRvcG2Cf9wIVzs9gIsZDHnzkUUHH` |
| **Vercel Org ID** | `team_C7yQXAa5iZowwg2bCl8lLG5n` |
| **Framework** | Next.js |
| **Expected Production URL** | `https://saas-clinic-ai.vercel.app` |
| **Last Known Prod Deployment ID** | `dpl_8oJrqVaYD9d9J1KEU4E3waFuaBMi` (verified 26 Jul 2026) |
| **Build Command** | `npx prisma generate && next build` |

---

## 2. Product Specification Decisions

### 2.1 Pilot Scope

The system is a WhatsApp-based AI receptionist for GCC aesthetic/health clinics. Current Pilot is limited to **a single clinic** ("Rival Beauty Clinic / عيادة ريفال للتجميل") with the following boundaries:

| Dimension | Scope | Reference |
|-----------|-------|-----------|
| **Markets** | GCC only: Saudi Arabia (SA), UAE (AE), Qatar (QA), Kuwait (KW), Bahrain (BH), Oman (OM) | `PILOT_READINESS_FINAL.md` |
| **Channels** | WhatsApp only (Meta Cloud API inbound → AI response) | `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` |
| **Languages** | Arabic primary, English fallback | System prompt configuration |
| **Booking Flow** | Single-service booking per conversation; multi-turn entity extraction (name → service → doctor → branch → time → confirm) | `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` §3 |
| **Dashboard** | Read-only reception dashboard for viewing and confirming/cancelling bookings | Deployment URL `/dashboard` |
| **Identity** | WhatsApp sender E.164 phone is the **canonical customer identifier**. No login/registration. | `RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE.md` §2 |

### 2.2 Expected Behavior

1. **WhatsApp → Webhook → AI Response**: Every inbound WhatsApp message is received at `/api/webhook/whatsapp`, decrypted (if needed), processed by ConversationEngine → BusinessEngine → AI, and a reply is sent back within ~3-5 seconds.
2. **Phone Auto-Attachment**: The WhatsApp sender E.164 phone is automatically attached as the client phone. The system MUST NOT prompt for phone number when the sender is already identified via WhatsApp.
3. **Non-GCC WhatsApp Senders**: If a sender has a non-GCC number (e.g., `+20...` Egyptian), the system MUST accept the number as-is (it is the canonical identity) but the booking is still created for the GCC clinic. The `extractSaudiPhone` validation is bypassed for WhatsApp sources.
4. **Booking Flow**: After collecting service, doctor, branch, and time, the system calls `createBooking` which writes a `PENDING` booking to the database. The reception dashboard then displays it for human confirmation.
5. **Structured Logging**: Every request produces 6 trace points with `event`, `requestId`, and `values` — observable in Vercel production logs.
6. **Health Check**: `GET /api/health` returns `{ status: "ok", db: "ok"|"error", ai: "ok"|"error", redis: "ok"|"error"|"timeout" }`.

### 2.3 Known Accepted Limitations

| Limitation | Severity | Rationale |
|------------|----------|-----------|
| **Race condition on simultaneous slot booking** | Medium | If two users book the same slot concurrently, one succeeds and the other gets "slot taken". Acceptable if <0.1%. Load test not yet executable (fixture issue). |
| **Time parsing ambiguity (Bug 11→07)** | Medium | AI may interpret "11" as 11:00 AM instead of 23:00 (11 PM). Observable via structured logs. Fix deferred post-launch. |
| **Health endpoint returns 503** | Low | `UPSTASH_REDIS_URL` not configured → Redis component times out. Redis is NOT on the critical path for WhatsApp message processing or booking creation. |
| **Conversation history truncated at 50 messages** | Low | `max_db_messages = 50` limit. Conversations longer than 50 turns lose oldest context. Acceptable for Pilot scale. |
| **No conversation flow integration tests** | Medium | All major bugs involved ≥3 message turns. Only unit tests and manual E2E exist. Post-pilot sprint planned. |
| **System prompt is filesystem-based, not runtime-configurable** | Low | Requires code deploy to change. Acceptable for Pilot; DevOps sprint planned. |
| **RAG KB indexing failures are silent** | Low | If RAG document ingestion fails, no error is surfaced. Acceptable for Pilot; observability sprint planned. |

### 2.4 Open Questions

| # | Question | Why It Matters | How to Resolve |
|---|----------|----------------|----------------|
| OQ-1 | Is `BYPASS_AUTH=true` intentionally set in Vercel production environment variables? | If yes, there is no authentication on any API endpoint. If no, must be removed before real launch. | Runtime verification: test auth on `/api/*` endpoints. |
| OQ-2 | Does the WhatsApp E.164 bypass actually work end-to-end in production? | Unit test passes, but real WhatsApp webhook flow with a non-GCC sender needs confirmation. | Send a WhatsApp message from a `+20...` number via the production webhook and verify no phone prompt appears. |
| OQ-3 | Does `BusinessEngine` auto-injection of sender phone correctly override AI-extracted local numbers? | If AI extracts a local number from conversation context (e.g., "رقمي 0555..."), does the sender E.164 still take precedence? | Production log inspection of multi-turn conversations. |
| OQ-4 | What is the actual race condition failure rate under real-world booking concurrency? | Determines if pessimistic locking is needed. | Load test execution (fixture fix required first) OR production observation during Pilot. |
| OQ-5 | Does the 50-message conversation limit cause observable UX issues at Pilot scale? | Truncated context may cause AI to "forget" earlier entities. | Production monitoring of conversation lengths and user complaints. |

---

## 3. Runtime Verification Checklist

For each item below, Antigravity must:
1. Execute the verification action
2. Compare against the expected result
3. Collect the specified evidence
4. Apply the Pass/Fail criteria

---

### RV-01: Health Endpoint Responds

| Field | Detail |
|-------|--------|
| **What must be verified** | `GET /api/health` returns a valid JSON response |
| **Expected result** | HTTP 200 (or 503 with valid JSON body). Response shape: `{ status: string, db: string, ai: string, redis: string }`. At minimum `db` and `ai` report `"ok"`. |
| **Evidence required** | Full HTTP response: status code, headers, body JSON |
| **Pass criteria** | HTTP status is 200 or 503. Body is valid JSON with all four fields present (`status`, `db`, `ai`, `redis`). |
| **Fail criteria** | No response, non-JSON body, missing required fields. |

---

### RV-02: Landing Page Serves

| Field | Detail |
|-------|--------|
| **What must be verified** | `GET /` serves the Next.js landing page |
| **Expected result** | HTTP 200 with HTML content containing Arabic text indicating the clinic receptionist system |
| **Evidence required** | HTTP status code, first 2KB of response body, `Content-Type` header |
| **Pass criteria** | HTTP 200, `Content-Type: text/html`, body contains Arabic script or known landing page text |
| **Fail criteria** | HTTP 5xx, 404, empty body, or non-HTML content type |

---

### RV-03: WhatsApp Webhook Endpoint Reachable

| Field | Detail |
|-------|--------|
| **What must be verified** | `GET /api/webhook/whatsapp` responds (Meta verification handshake endpoint) |
| **Expected result** | The endpoint exists and is reachable. It is designed to respond to Meta's `hub.challenge` verification — returning the challenge value when `hub.mode=subscribe` and `hub.verify_token` matches. |
| **Evidence required** | HTTP response for a GET request to the endpoint (status code, body) |
| **Pass criteria** | HTTP 200 or 405. If 200, the endpoint returns the challenge echo. |
| **Fail criteria** | HTTP 5xx, 404, or connection timeout. |

---

### RV-04: Structured Logging Trace Points Fire

| Field | Detail |
|-------|--------|
| **What must be verified** | When a production request flows through the system, 6 structured log events are emitted |
| **Expected result** | For any processed request, exactly 6 trace points appear in Vercel production logs: `webhook_received`, `conversation_loaded`, `ai_request`, `ai_response`, `business_engine_action`, `webhook_response`. Each contains `event`, `requestId`, and `values`. |
| **Evidence required** | Vercel production log entries containing the event names. Screenshot or log export showing all 6 events for a single `requestId`. |
| **Pass criteria** | All 6 trace point events are present in logs for a single request, each with `event`, `requestId`, and `values` fields. |
| **Fail criteria** | Fewer than 6 events, missing `requestId`, missing `values`, or events not emitted at all. |

---

### RV-05: WhatsApp Webhook Processes Message End-to-End

| Field | Detail |
|-------|--------|
| **What must be verified** | `POST /api/webhook/whatsapp` accepts a valid WhatsApp message payload and returns a response |
| **Expected result** | HTTP 200 with body indicating the message was processed. The AI provider is called and returns a response. |
| **Evidence required** | HTTP response (status + body). If possible, inspect Vercel logs to confirm the full pipeline ran (all 6 trace points). |
| **Pass criteria** | HTTP 200. Logs show all 6 trace points with `event: "webhook_response"` at the end. |
| **Fail criteria** | HTTP 5xx, timeout, or missing trace points indicating a pipeline break. |

---

### RV-06: Phone Validation Does Not Block WhatsApp Senders

| Field | Detail |
|-------|--------|
| **What must be verified** | A simulated booking request from a WhatsApp source with a non-GCC number (`+20...`, `+971...`) is accepted without a phone prompt |
| **Expected result** | `POST /api/webhook/whatsapp` with a payload containing a `+20...` sender and booking intent returns a response that does NOT ask for a phone number. The `validateBookingData` function accepts the number because `data.source === "WhatsApp"`. |
| **Evidence required** | Test payload and response. Verify the AI response text does not contain phone-requesting phrases (e.g., "رقم تواصل", "رقم الجوال", "phone"). |
| **Pass criteria** | No phone-prompt text in the AI response. The conversation state advances past phone collection. |
| **Fail criteria** | AI response asks for a phone number. Conversation stalls at phone validation. |

---

### RV-07: Conversation Creation and Persistence

| Field | Detail |
|-------|--------|
| **What must be verified** | A conversation record is created/updated in the database when a WhatsApp message is processed |
| **Expected result** | After processing a WhatsApp message, a row exists in the `conversation` table (or equivalent) with the sender's phone as the identifier, and the message is stored. |
| **Evidence required** | Database query result showing the conversation record with the correct `clientPhone` (E.164 format) and at least one message entry. |
| **Pass criteria** | Conversation record exists with correct `clientPhone` E.164. At least one message entry is stored. |
| **Fail criteria** | No conversation record created. Message not persisted. Wrong phone format (non-E.164). |

---

### RV-08: Booking Creation Pipeline

| Field | Detail |
|-------|--------|
| **What must be verified** | A complete booking request creates a `PENDING` booking in the database |
| **Expected result** | When the AI successfully extracts service, doctor, branch, and time, and the user confirms, `createBooking` is called and a booking row appears with `status: "PENDING"` in the database. |
| **Evidence required** | Database query showing the booking record with correct fields: `clientPhone` (E.164), `serviceName`, `doctorName`, `branchName`, `appointmentTime`, `status: "PENDING"`. |
| **Pass criteria** | Booking record exists with all required fields populated. Status is `PENDING`. |
| **Fail criteria** | No booking record. Missing required fields. Wrong status. Phone number is not E.164. |

---

### RV-09: Reception Dashboard Loads and Displays Bookings

| Field | Detail |
|-------|--------|
| **What must be verified** | `GET /dashboard` loads and displays booking data |
| **Expected result** | The dashboard page renders with at least the existing bookings visible (29 conversations verified in production). The booking table/UI shows client name, service, time, and status. |
| **Evidence required** | Screenshot or HTML content of the dashboard page showing booking records. |
| **Pass criteria** | Page loads (HTTP 200). Booking data is displayed. No "No data" or error states visible. |
| **Fail criteria** | HTTP 5xx, 404, empty page, JavaScript errors preventing render, or "No bookings" message when data exists. |

---

### RV-10: Booking Confirmation Updates Status

| Field | Detail |
|-------|--------|
| **What must be verified** | Confirming a booking via the dashboard updates `Booking.status` to `CONFIRMED` |
| **Expected result** | `POST /api/bookings/{id}/confirm` (or equivalent) returns HTTP 200 and the database booking record shows `status: "CONFIRMED"`. `Conversation.updatedAt` is updated. |
| **Evidence required** | HTTP response from the confirm endpoint. Database query before and after confirmation showing the status change. |
| **Pass criteria** | HTTP 200. Database status changes from `PENDING` to `CONFIRMED`. |
| **Fail criteria** | HTTP error. Status does not change. `Conversation.updatedAt` not updated. |

---

### RV-11: Auth Middleware Correctly Secures API Endpoints

| Field | Detail |
|-------|--------|
| **What must be verified** | API endpoints require authentication (unless `BYPASS_AUTH` is the configured behavior) |
| **Expected result** | If `BYPASS_AUTH` is NOT active: unauthenticated requests to `/api/*` return 401/403. If `BYPASS_AUTH` IS active (as found in production): all requests pass through without auth challenge. |
| **Evidence required** | Two test requests to `/api/conversations` or `/api/bookings`: one with no auth header, one with a valid session. Record responses. |
| **Pass criteria** | If `BYPASS_AUTH=true`: both requests succeed (200). If `BYPASS_AUTH` is removed/false: unauthenticated request returns 401/403, authenticated request returns 200. |
| **Fail criteria** | Auth middleware allows unauthenticated access when `BYPASS_AUTH` is not set, or rejects authenticated requests incorrectly. |

---

### RV-12: All PF Regression Tests Pass In CI

| Field | Detail |
|-------|--------|
| **What must be verified** | The PF regression test suite passes on the deployed commit |
| **Expected result** | `npx vitest run src/__tests__/unit/pilot_stabilization_sprint.test.ts` exits with code 0, all 4 tests passing (PF-001 through PF-004) |
| **Evidence required** | Test runner output showing 4/4 passing (or the CI equivalent) |
| **Pass criteria** | All 4 tests pass. PF-001 specifically verifies WhatsApp source bypass for non-GCC numbers. |
| **Fail criteria** | Any test fails. PF-001 fails (would indicate WhatsApp bypass is not working). |

---

## 4. Items Requiring Production Verification Only

These items CANNOT be verified in staging, local, or CI — they require real WhatsApp traffic hitting the production environment.

---

### PV-01: WhatsApp → Webhook → AI → Response Round-Trip Latency

| Field | Detail |
|-------|--------|
| **What must be verified** | End-to-end latency from WhatsApp message receipt to AI response delivery |
| **Why production only** | WhatsApp API call-outs, AI provider latency, and database I/O combine in ways that cannot be meaningfully simulated. |
| **Expected result** | Round-trip completes within 3-5 seconds for typical messages. Longer for complex multi-entity extraction. |
| **Evidence required** | Timestamp in `webhook_received` vs `webhook_response` structured log events for the same `requestId`. |
| **Pass criteria** | P50 latency < 5s. P95 latency < 10s. |
| **Fail criteria** | Average > 10s, or webhook timeout errors from WhatsApp Meta API. |

---

### PV-02: Multi-Turn Conversation Continuity

| Field | Detail |
|-------|--------|
| **What must be verified** | The AI maintains context across 3+ consecutive messages in a single conversation |
| **Why production only** | Only real users produce multi-turn conversations with natural Arabic phrasing and context shifts. |
| **Expected result** | After 3+ messages (e.g., inquiry → service selection → time → confirmation), the AI remembers previously extracted entities and does not re-ask for them. |
| **Evidence required** | Full conversation transcript from production logs showing all messages and AI responses across ≥3 turns. |
| **Pass criteria** | No repeated entity requests. Conversation state advances monotonically through the booking flow. |
| **Fail criteria** | AI re-asks for previously provided information. Dialogue loops (PF-003 scenario). Entities disappear between turns. |

---

### PV-03: Non-GCC WhatsApp Sender Phone Bypass (Real Traffic)

| Field | Detail |
|-------|--------|
| **What must be verified** | A real WhatsApp user with a non-GCC number (e.g., Egyptian `+20...`) can complete a booking without being prompted for phone |
| **Why production only** | Requires a real WhatsApp sender account with a non-GCC number, connected to the production Meta Cloud API. |
| **Expected result** | The user sends a booking request (e.g., "عاوزة احجز عند دكتورة سحر بكره"), and the AI progresses through the booking flow without ever asking for a phone number. |
| **Evidence required** | Full conversation transcript. Structured log events showing `validateBookingData` accepted the number via WhatsApp bypass. |
| **Pass criteria** | No phone prompt. Booking is created with the sender's E.164 as `clientPhone`. |
| **Fail criteria** | Phone prompt appears. Booking fails with "unsupported country" or similar validation error. |

---

### PV-04: Booking Confirmation WhatsApp Notification

| Field | Detail |
|-------|--------|
| **What must be verified** | When a receptionist confirms a booking from the dashboard, the patient receives a WhatsApp notification |
| **Why production only** | Requires the production Meta Cloud API. WhatsApp notification delivery cannot be tested locally. |
| **Expected result** | After clicking "Confirm" on a booking in the dashboard, a WhatsApp message is sent to the patient confirming their appointment with service, doctor, branch, date, and time. |
| **Evidence required** | Screenshot of the dashboard confirmation action. Evidence that the patient received the WhatsApp message (patient confirmation or log of outbound message). |
| **Pass criteria** | WhatsApp notification is delivered to the patient within 30 seconds of confirmation. |
| **Fail criteria** | No notification sent. Notification contains incorrect booking details. Notification delivery fails. |

---

### PV-05: Structured Log Data Quality Under Real Load

| Field | Detail |
|-------|--------|
| **What must be verified** | Structured logs contain sufficient information to debug production issues |
| **Why production only** | Only real traffic produces the variety of edge cases, error states, and conversation paths needed to evaluate log quality. |
| **Expected result** | Logs contain: `requestId` linking all events, extracted entities (service, doctor, time), validation decisions, AI response text excerpt, and any error states. Logs are not truncated or redacted in ways that prevent debugging. |
| **Evidence required** | Log export for 3-5 real conversations showing complete trace data. |
| **Pass criteria** | Every log event is usable for debugging: error states have stack traces or error codes, validation decisions have the input values and decision reason, AI responses reference the extracted entities. |
| **Fail criteria** | Logs missing critical context (e.g., "validation failed" without saying which field). `requestId` chains broken. Values truncated without indication. |

---

### PV-06: Dashboard Data Freshness Under Real Usage

| Field | Detail |
|-------|--------|
| **What must be verified** | Bookings appear on the dashboard in near-real-time after WhatsApp booking completion |
| **Why production only** | Requires concurrent WhatsApp traffic and dashboard access. |
| **Expected result** | Within 10 seconds of a booking being created via WhatsApp, it appears in the dashboard with status `PENDING`. |
| **Evidence required** | Timestamp of `createBooking` (from logs) vs timestamp of first appearance on dashboard (screenshot or periodic polling). |
| **Pass criteria** | Lag < 10 seconds. Booking status, service, doctor, time, and client name are all displayed correctly. |
| **Fail criteria** | Booking does not appear. Data is stale (e.g., missing recent bookings). Wrong status displayed. |

---

### PV-07: Error Handling Under Unusual Conditions

| Field | Detail |
|-------|--------|
| **What must be verified** | System gracefully handles out-of-scope queries, missing data, and unexpected inputs |
| **Why production only** | Real users produce unpredictable inputs that no unit test covers. |
| **Expected result** | For any input: (1) The system always returns a WhatsApp response (never crashes silently). (2) If the AI cannot handle the request, it asks for clarification or escalates — it does not produce a generic error or empty response. (3) No 5xx errors in logs. |
| **Evidence required** | Logs from 10+ real conversations covering varied intents. Count of 5xx errors. Count of empty AI responses. |
| **Pass criteria** | Zero unhandled 5xx errors. Zero empty AI responses. All inputs receive a valid Arabic response. |
| **Fail criteria** | Any 5xx error. Any empty or generic error response in a real conversation. |

---

## Appendix: Verification Priority Matrix

| ID | Item | Priority | Can Be Automated? | Dependencies |
|----|------|----------|-------------------|--------------|
| RV-01 | Health endpoint | **P0** | ✅ Yes | None |
| RV-02 | Landing page | **P0** | ✅ Yes | None |
| RV-03 | Webhook reachable | **P0** | ✅ Yes | None |
| RV-05 | Webhook processes message | **P0** | ✅ Yes (simulated payload) | Test payload |
| RV-06 | Phone validation bypass | **P0** | ✅ Yes (simulated payload) | Test payload |
| RV-11 | Auth middleware | **P0** | ✅ Yes | None (or BYPASS_AUTH env check) |
| RV-04 | Structured logging | **P1** | ✅ Yes (log inspection) | RV-05 must pass first |
| RV-07 | Conversation persistence | **P1** | ✅ Yes (API + DB query) | RV-05, DB access |
| RV-08 | Booking creation | **P1** | ✅ Yes (API + DB query) | RV-05, DB access |
| RV-09 | Dashboard loads | **P1** | ✅ Yes (HTTP + screenshot) | None |
| RV-12 | PF regression tests | **P1** | ✅ Yes (CI) | Build environment |
| RV-10 | Booking confirmation | **P2** | ✅ Yes (API + DB query) | RV-08, DB access |
| PV-01 | Latency | **P1** | ✅ Yes (log analysis) | RV-04, real traffic |
| PV-02 | Multi-turn continuity | **P1** | ❌ Manual | Real WhatsApp user |
| PV-03 | Non-GCC bypass (real) | **P1** | ❌ Manual | Real non-GCC WhatsApp account |
| PV-04 | Booking WhatsApp notification | **P1** | ❌ Manual | Real dashboard user + WhatsApp |
| PV-05 | Log data quality | **P2** | ❌ Manual analysis | RV-04, real traffic |
| PV-06 | Dashboard freshness | **P2** | ❌ Manual | Booking creation + dashboard access |
| PV-07 | Error handling | **P2** | ❌ Manual analysis | Real traffic |

---

*End of Runtime Verification Handoff Package*
