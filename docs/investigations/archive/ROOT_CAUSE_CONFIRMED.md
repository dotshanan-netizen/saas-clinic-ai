# Root Cause Confirmed — Runtime Reproduction Report

**Reproduction Date:** 2026-07-28T05:36:38.757Z
**Model:** gemini-2.0-flash-lite (via AIProvider.ts)
**Conversation:** السلام عليكم → أريد الحجز → 0501234567 → فيلر → الصحافة
**API Key Used:** Gemini

---

## Result: 🟢 NO PHANTOM TIME DETECTED


### Evidence (full trace)

```
═══════════════════════════════════════════════════════════════
🔬 PHANTOM TIME ROOT CAUSE — Runtime Reproduction
   Date: 2026-07-28T05:36:31.438Z
   Model: gemini-2.0-flash-lite (via AIProvider.ts)
═══════════════════════════════════════════════════════════════

╔══════════════════════════════════════════════════════════════╗
║  TURN 1: "السلام عليكم"
╚══════════════════════════════════════════════════════════════╝

[1/8] RAW USER MESSAGE: "السلام عليكم"

[2/8] TIMEEXTRACTOR
  extractedTime: null
  normalizedTime: null
  isAmbiguous: false
  remainingText: "السلام عليكم"

[3/8] CURRENT STATE (before AI call)
  History length: 1 messages
  clientName: null
  clientPhone: null
  serviceName: null
  doctorName: null
  branchName: null
  timeSlot: null

[4/8] AI PROVIDER CALL
  Calling AIProvider.classifyIntentAndExtractData()...
  AI Latency: 2370ms
  prompt_tokens: 3466
  completion_tokens: 121

[5/8] RAW AI RESPONSE
  intent: "Inquiry"
  response_preview: "وعليكم السلام ورحمة الله وبركاته، يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸"
  humanTakeover: false
  requiresRag: false
  bookingData (raw from AI):
    .clientName: null
    .clientPhone: null
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[6/8] INTENT-AWARE MERGE (ConversationEngine.ts:314-351)
    .clientName: null
    .clientPhone: null
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[7/8] TIMENORMALIZER
  input (from bookingData): null
  input (from merged): null
  output: null

[8/8] STATE UPDATE FOR NEXT TURN
  Non-booking intent "Inquiry" — resetting booking fields
  history.length: 3
  currentState.timeSlot: null

╔══════════════════════════════════════════════════════════════╗
║  TURN 2: "أريد الحجز"
╚══════════════════════════════════════════════════════════════╝

[1/8] RAW USER MESSAGE: "أريد الحجز"

[2/8] TIMEEXTRACTOR
  extractedTime: null
  normalizedTime: null
  isAmbiguous: false
  remainingText: "أريد الحجز"

[3/8] CURRENT STATE (before AI call)
  History length: 4 messages
  clientName: null
  clientPhone: null
  serviceName: null
  doctorName: null
  branchName: null
  timeSlot: null

[4/8] AI PROVIDER CALL
  Calling AIProvider.classifyIntentAndExtractData()...
  AI Latency: 602ms
  prompt_tokens: 3513
  completion_tokens: 1

[5/8] RAW AI RESPONSE
  intent: "BookAppointment"
  response_preview: ""
  humanTakeover: false
  requiresRag: false
  bookingData (raw from AI):
    .clientName: null
    .clientPhone: null
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[6/8] INTENT-AWARE MERGE (ConversationEngine.ts:314-351)
    .clientName: null
    .clientPhone: null
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[7/8] TIMENORMALIZER
  input (from bookingData): null
  input (from merged): null
  output: null

[8/8] STATE UPDATE FOR NEXT TURN
  Updated state (timeSlot PURPOSELY cleared per P2 rule)
  nextState.timeSlot: null
  history.length: 5
  currentState.timeSlot: null

╔══════════════════════════════════════════════════════════════╗
║  TURN 3: "0501234567"
╚══════════════════════════════════════════════════════════════╝

[1/8] RAW USER MESSAGE: "0501234567"

[2/8] TIMEEXTRACTOR
  extractedTime: null
  normalizedTime: null
  isAmbiguous: false
  remainingText: "0501234567"

[3/8] CURRENT STATE (before AI call)
  History length: 6 messages
  clientName: null
  clientPhone: null
  serviceName: null
  doctorName: null
  branchName: null
  timeSlot: null

[4/8] AI PROVIDER CALL
  Calling AIProvider.classifyIntentAndExtractData()...
  AI Latency: 1400ms
  prompt_tokens: 3525
  completion_tokens: 72

[5/8] RAW AI RESPONSE
  intent: "BookAppointment"
  response_preview: "أحتاج اسمكِ الكريمة قبل أن أكمل إجراءات الحجز. 🌷"
  humanTakeover: false
  requiresRag: false
  bookingData (raw from AI):
    .clientName: ""
    .clientPhone: "0501234567"
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[6/8] INTENT-AWARE MERGE (ConversationEngine.ts:314-351)
    .clientName: null
    .clientPhone: "0501234567"
    .serviceName: null
    .doctorName: null
    .branchName: null
    .timeSlot: null

[7/8] TIMENORMALIZER
  input (from bookingData): null
  input (from merged): null
  output: null

[8/8] STATE UPDATE FOR NEXT TURN
  Updated state (timeSlot PURPOSELY cleared per P2 rule)
  nextState.timeSlot: null
  history.length: 7
  currentState.timeSlot: null

╔══════════════════════════════════════════════════════════════╗
║  TURN 4: "فيلر"
╚══════════════════════════════════════════════════════════════╝

[1/8] RAW USER MESSAGE: "فيلر"

[2/8] TIMEEXTRACTOR
  extractedTime: null
  normalizedTime: null
  isAmbiguous: false
  remainingText: "فيلر"

[3/8] CURRENT STATE (before AI call)
  History length: 8 messages
  clientName: null
  clientPhone: "0501234567"
  serviceName: null
  doctorName: null
  branchName: null
  timeSlot: null

[4/8] AI PROVIDER CALL
  Calling AIProvider.classifyIntentAndExtractData()...
  AI Latency: 1534ms
  prompt_tokens: 3555
  completion_tokens: 93

[5/8] RAW AI RESPONSE
  intent: "BookAppointment"
  response_preview: "أحتاج اسمكِ الكريمة قبل أن أكمل إجراءات الحجز. 🌷"
  humanTakeover: false
  requiresRag: false
  bookingData (raw from AI):
    .clientName: null
    .clientPhone: "0501234567"
    .serviceName: "فيلر"
    .doctorName: null
    .branchName: null
    .timeSlot: null

[6/8] INTENT-AWARE MERGE (ConversationEngine.ts:314-351)
    .clientName: null
    .clientPhone: "0501234567"
    .serviceName: "فيلر"
    .doctorName: null
    .branchName: null
    .timeSlot: null

[7/8] TIMENORMALIZER
  input (from bookingData): null
  input (from merged): null
  output: null

[8/8] STATE UPDATE FOR NEXT TURN
  Updated state (timeSlot PURPOSELY cleared per P2 rule)
  nextState.timeSlot: null
  history.length: 9
  currentState.timeSlot: null

╔══════════════════════════════════════════════════════════════╗
║  TURN 5: "الصحافة"
╚══════════════════════════════════════════════════════════════╝

[1/8] RAW USER MESSAGE: "الصحافة"

[2/8] TIMEEXTRACTOR
  extractedTime: null
  normalizedTime: null
  isAmbiguous: false
  remainingText: "الصحافة"

[3/8] CURRENT STATE (before AI call)
  History length: 10 messages
  clientName: null
  clientPhone: "0501234567"
  serviceName: "فيلر"
  doctorName: null
  branchName: null
  timeSlot: null

[4/8] AI PROVIDER CALL
  Calling AIProvider.classifyIntentAndExtractData()...
  AI Latency: 1401ms
  prompt_tokens: 3583
  completion_tokens: 96

[5/8] RAW AI RESPONSE
  intent: "BookAppointment"
  response_preview: "أحتاج اسمكِ الكريمة قبل أن أكمل إجراءات الحجز. 🌷"
  humanTakeover: false
  requiresRag: false
  bookingData (raw from AI):
    .clientName: null
    .clientPhone: "0501234567"
    .serviceName: "فيلر"
    .doctorName: null
    .branchName: "الصحافة"
    .timeSlot: null

[6/8] INTENT-AWARE MERGE (ConversationEngine.ts:314-351)
    .clientName: null
    .clientPhone: "0501234567"
    .serviceName: "فيلر"
    .doctorName: null
    .branchName: "الصحافة"
    .timeSlot: null

[7/8] TIMENORMALIZER
  input (from bookingData): null
  input (from merged): null
  output: null

[8/8] STATE UPDATE FOR NEXT TURN
  Updated state (timeSlot PURPOSELY cleared per P2 rule)
  nextState.timeSlot: null
  history.length: 11
  currentState.timeSlot: null
```


---

## Verification: No Other Component Could Have Produced "N/A"

| Component | Analysis | Verdict |
|-----------|----------|---------|
| **TimeExtractor.extract()** | Scans for digits, HH:MM, AM/PM. "الصحافة" matches ZERO patterns. TimeExtractor returns `null` for ALL 5 messages. | ✅ NOT source |
| **TimeNormalizer.normalize()** | Strictly idempotent — cannot create time from null input. Only normalizes existing time strings. | ✅ NOT source |
| **ConversationEngine currentState** | timeSlot explicitly set to null initially (line 195). Draft restoration destructures timeSlot away (line 212). Controlled Merge Guard (line 326) only allows timeSlot merge if user message contains a time keyword. "الصحافة" has no time keyword. | ✅ NOT source |
| **BusinessEngine regex fallback** | Only matches name, service, doctor, branch patterns. No time extraction from "الصحافة". | ✅ NOT source |
| **BusinessEngine merge guard** | Only guards branch/service/doctor — NOT timeSlot. But currentState.timeSlot is null anyway. | ✅ NOT source |
| **Hardcoded string** | `"05:00 م"` appears nowhere in `src/**/*.ts` source code | ✅ NOT source |
