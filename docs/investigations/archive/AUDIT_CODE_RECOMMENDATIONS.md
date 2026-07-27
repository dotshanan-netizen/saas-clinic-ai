# CLINOVA AUDIT: SPECIFIC CODE RECOMMENDATIONS

This document provides **exact code changes** for the Top 10 risks. No implementation—only guidance.

---

## FIX #1: Remove BYPASS_AUTH from Production (2 hours)

### Current Code (middleware.ts:9-49)
```typescript
if (process.env.BYPASS_AUTH === "true") {
  if (path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (path.startsWith('/dashboard')) {
    const payload = {
      userId: "mock-development-user-id",
      clinicId: "cmryoendy0000dzrctyxgyf3k",
      role: "ADMIN",
      slug: "rival-clinic"
    };
    // ... auto-login
  }
}
```

### Recommended Change
**Option A: Remove entirely (recommended)**
- Delete the entire BYPASS_AUTH block
- Create separate `.dev-middleware.ts` for local development
- Use `.env.local` for testing (gitignored)

**Option B: Restrict to localhost only**
```typescript
const isDev = process.env.NODE_ENV === "development";
const isLocalhost = request.nextUrl.hostname === "localhost";

if (isDev && isLocalhost && process.env.BYPASS_AUTH === "true") {
  // Auto-login logic (safe, can't escape localhost)
}
```

### Verification
```bash
# Before deploying to production:
grep -r "BYPASS_AUTH" src/
# Should return 0 results
```

---

## FIX #2: Remove TypeScript `ignoreBuildErrors` (4 hours)

### Current Code (next.config.ts)
```typescript
const nextConfig: any = {
  typescript: {
    ignoreBuildErrors: true,  // ← DELETE
  },
  eslint: {
    ignoreDuringBuilds: true,  // ← DELETE
  }
};
```

### Recommended Change
```typescript
const nextConfig = {
  // typescript: { ignoreBuildErrors: false } ← default, explicit
  // eslint: { ignoreDuringBuilds: false } ← default, explicit
};
```

### Then Fix Compilation Errors
- Run `npx tsc --noEmit` to find all errors
- Fix type annotations (see recommended patterns below)
- Address any unhandled `any` types

### Common Patterns to Fix
```typescript
// ❌ WRONG
const payload: any = aiResult;

// ✅ CORRECT
interface AIResult {
  intent: AIIntent;
  response: string;
  bookingData: ExtractedBookingData;
}
const payload: AIResult = aiResult;
```

```typescript
// ❌ WRONG
} catch (err: any) {
  console.error(err);
}

// ✅ CORRECT
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
}
```

---

## FIX #3: Fix Phone Number Regex Fallback (1 hour)

### Current Code (types.ts:102-104)
```typescript
const structuralMatch = clean.match(/^\+?[1-9]\d{8,14}$/);
if (structuralMatch) {
  return clean.startsWith("+") ? clean : "+" + clean;
}
```

### Problem
- Accepts any 9-15 digit number, even invalid country codes (+999999...)
- libphonenumber-js already validated, shouldn't need this fallback

### Recommended Change
**Option A: Remove fallback entirely**
```typescript
// Remove lines 102-105
// If libphonenumber-js validates, use it. Otherwise return null.
// No structural fallback.

export function extractSaudiPhone(text: string | null, defaultCountry: string = "SA"): string | null {
  const sanitized = sanitizeAIValue(text);
  if (!sanitized) return null;
  
  const clean = sanitized.replace(/[\s-]/g, "");
  
  // 0. Mock test phones
  if (clean.includes("000000") || ...) { /* ... */ }
  
  // 1. Global parse
  if (clean.startsWith("+") || clean.startsWith("00")) {
    try {
      const globalClean = clean.startsWith("00") ? "+" + clean.slice(2) : clean;
      const globalPhone = parsePhoneNumberFromString(globalClean);
      if (globalPhone && globalPhone.isValid()) {
        return globalPhone.format("E.164");
      }
    } catch { }
  }
  
  // 2. Default country parse
  try {
    const phoneNumber = parsePhoneNumberFromString(clean, defaultCountry as CountryCode);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format("E.164");
    }
  } catch { }
  
  // 3. Saudi local shortcut
  if (defaultCountry.toUpperCase() === "SA") {
    const localMatch = clean.match(/(?<!\d)(?:0)?5\d{8}(?!\d)/);
    if (localMatch) {
      const localClean = localMatch[0];
      const saPhone = localClean.startsWith("0") ? "+966" + localClean.slice(1) : "+966" + localClean;
      try {
        const check = parsePhoneNumberFromString(saPhone);
        if (check && check.isValid()) return check.format("E.164");
      } catch { }
      // Accept Saudi structural format only if starts with 966 or 05
      if (saPhone.startsWith("+966")) return saPhone;
    }
  }
  
  return null;  // ← No fallback regex
}
```

**Option B: Restrict to known country codes**
```typescript
const validCountryCodes = [
  "1",    // US/Canada
  "44",   // UK
  "966",  // Saudi Arabia
  "971",  // UAE
  "20",   // Egypt
  // ... add others as needed
];

const structuralMatch = clean.match(/^\+?[1-9]\d{8,14}$/);
if (structuralMatch) {
  const countryCodeMatch = clean.match(/^\+?(\d{1,3})/);
  const countryCode = countryCodeMatch ? countryCodeMatch[1] : null;
  
  if (countryCode && validCountryCodes.includes(countryCode)) {
    return clean.startsWith("+") ? clean : "+" + clean;
  }
}
```

### Test Case
```typescript
// Should REJECT
extractSaudiPhone("+99999999999", "SA") // Currently returns "+99999999999", should return null

// Should ACCEPT
extractSaudiPhone("+966501234567", "SA") // Returns "+966501234567" ✓
extractSaudiPhone("0501234567", "SA")   // Returns "+966501234567" ✓
```

---

## FIX #4: Implement Pessimistic Slot Locking (3 hours)

### Current Flow (Race Condition)
```typescript
// Step 1: Check available slots (stale)
const availableSlots = await BookingService.getAvailableSlots(clinicId, doctorName);
// ... check if slot matches

// Step 2: Assume slot still available, create booking
await prisma.$transaction(async (tx) => {
  const conflict = await tx.booking.findFirst({...});
  if (conflict) throw error;
  await tx.booking.create({...});  // May fail under concurrency
});
```

### Recommended Change
**Add slot reservation table:**
```prisma
model SlotReservation {
  id        String   @id @default(cuid())
  clinicId  String
  doctorName String
  timeSlot  String
  reservedUntil DateTime  // Expires after 5 minutes
  createdAt DateTime @default(now())
  
  @@unique([clinicId, doctorName, timeSlot])
  @@index([reservedUntil])
}
```

**Pessimistic locking:**
```typescript
export class BookingService {
  static async getAvailableSlots(clinicId: string, doctorName: string) {
    // Existing logic
  }
  
  static async reserveSlot(clinicId: string, doctorName: string, timeSlot: string, reservationMinutes: number = 5) {
    const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
    
    try {
      await prisma.slotReservation.create({
        data: {
          clinicId,
          doctorName,
          timeSlot,
          reservedUntil: expiresAt
        }
      });
      return { reserved: true, expiresAt };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        // Slot already reserved
        return { reserved: false, reason: "Slot already reserved by another user" };
      }
      throw err;
    }
  }
  
  static async releaseSlot(clinicId: string, doctorName: string, timeSlot: string) {
    await prisma.slotReservation.delete({
      where: {
        clinicId_doctorName_timeSlot: { clinicId, doctorName, timeSlot }
      }
    });
  }
  
  static async confirmBooking(clinicId: string, doctorName: string, timeSlot: string, bookingData: any) {
    return await prisma.$transaction(async (tx) => {
      // Check reservation is still valid
      const reservation = await tx.slotReservation.findUnique({
        where: {
          clinicId_doctorName_timeSlot: { clinicId, doctorName, timeSlot }
        }
      });
      
      if (!reservation || reservation.reservedUntil < new Date()) {
        throw new Error("Reservation expired");
      }
      
      // Create booking
      const booking = await tx.booking.create({
        data: {
          clinicId,
          doctorName,
          timeSlot,
          ...bookingData
        }
      });
      
      // Remove reservation
      await tx.slotReservation.delete({
        where: {
          clinicId_doctorName_timeSlot: { clinicId, doctorName, timeSlot }
        }
      });
      
      return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
```

**Usage in BusinessEngine:**
```typescript
// After validation, before booking creation:
const reservation = await BookingService.reserveSlot(
  clinic.id,
  validation.normalizedDoctor,
  validation.cleanTimeSlot,
  5  // Reserve for 5 minutes
);

if (!reservation.reserved) {
  finalResponse = "الوقت تم حجزه للتو. أرجو اختيار وقت آخر 🌷";
  return { finalResponse, bookingCreated: false, ... };
}

// Later, when user confirms:
try {
  const booking = await BookingService.confirmBooking(
    clinic.id,
    validation.normalizedDoctor,
    validation.cleanTimeSlot,
    finalBookingData
  );
  bookingCreated = true;
} catch (err) {
  if (err.message === "Reservation expired") {
    finalResponse = "انتهت مهلة الحجز. أرجو اختيار وقت آخر 🌷";
    bookingCreated = false;
  }
  throw err;
}
```

---

## FIX #5: Add Explicit Error Classification (2 hours)

### Define Error Hierarchy
```typescript
// lib/domain/errors.ts
export enum ErrorCode {
  // Booking errors
  SLOT_UNAVAILABLE = "SLOT_UNAVAILABLE",
  DOUBLE_BOOKING = "DOUBLE_BOOKING",
  INVALID_PHONE = "INVALID_PHONE",
  MISSING_FIELD = "MISSING_FIELD",
  
  // AI errors
  AI_API_TIMEOUT = "AI_API_TIMEOUT",
  AI_RATE_LIMIT = "AI_RATE_LIMIT",
  AI_PARSE_ERROR = "AI_PARSE_ERROR",
  
  // Database errors
  DB_CONNECTION = "DB_CONNECTION",
  DB_CONSTRAINT = "DB_CONSTRAINT",
  
  // Auth errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  
  // Generic
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class ClinovaError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = "ClinovaError";
  }
}
```

### Use in Code
```typescript
// ❌ OLD
if (!slotIsAvailable) {
  finalResponse = `عذراً، الوقت الذي اخترته لم يعد متاحاً...`;
  return { finalResponse, bookingCreated: false, ... };
}

// ✅ NEW
if (!slotIsAvailable) {
  const error = new ClinovaError(
    ErrorCode.SLOT_UNAVAILABLE,
    `Slot ${validation.cleanTimeSlot} not available for doctor ${validation.normalizedDoctor}`,
    { slot: validation.cleanTimeSlot, doctor: validation.normalizedDoctor }
  );
  Logger.error("Slot unavailable", error, { requestId, clinicId: clinic.id, clientPhone });
  throw error;
}
```

### Catch and Respond
```typescript
try {
  // ... booking flow
} catch (err: unknown) {
  const cliErr = err instanceof ClinovaError ? err : null;
  
  if (cliErr?.code === ErrorCode.SLOT_UNAVAILABLE) {
    finalResponse = "الوقت تم حجزه للتو. اخترِ وقت آخر 🌷";
  } else if (cliErr?.code === ErrorCode.DOUBLE_BOOKING) {
    finalResponse = "حدث تعارض في الحجز. أرجو المحاولة مجددًا 🌷";
  } else if (cliErr?.code === ErrorCode.INVALID_PHONE) {
    finalResponse = "رقم الجوال غير صحيح. أرجو التأكد 🌷";
  } else {
    finalResponse = "عذراً، حدث خطأ تقني. سيتواصل معك موظف الاستقبال 🌷";
    aiResult.humanTakeover = true;
  }
}
```

---

## FIX #6: Monitor AI Validation Failures (2 hours)

### Current Code (AIProvider.ts)
```typescript
const parsed = AIResponseSchema.safeParse(aiResult);
// Silent failure, no logging
```

### Recommended Change
```typescript
const parsed = AIResponseSchema.safeParse(aiResult);

if (!parsed.success) {
  const validationError = parsed.error;
  Logger.error(
    "AIResponseSchema validation failed",
    {
      errors: validationError.errors,
      received: aiResult,
    },
    {
      requestId,
      clinicId: clinic.id,
      clientPhone,
    }
  );
  
  // Track metric
  Logger.metric("ai_schema_validation_failure", 1, {
    requestId,
    clinicId: clinic.id,
    clientPhone,
    failureReason: validationError.errors[0]?.code || "unknown",
  });
  
  // Escalate
  aiResult = {
    intent: "Unknown",
    response: "عذراً، واجهت مشكلة تقنية...",
    humanTakeover: true,
    requiresRag: false,
    bookingData: null,
  };
}
```

### Alerting Threshold
```typescript
// In monitoring/alerting:
IF metric("ai_schema_validation_failure") > 10 OVER_WINDOW(1h)
THEN alert("AI response parsing failure rate spike")
```

---

## FIX #7: Archive Conversation History (4 hours)

### Add Archive Table
```prisma
model ConversationArchive {
  id          String   @id @default(cuid())
  conversationId String
  messagesSnapshot Json  // Archived messages batch
  archivedAt  DateTime @default(now())
  
  @@index([conversationId, archivedAt])
}
```

### Update Conversation Handling
```typescript
// ConversationEngine.ts
const MAX_DB_MESSAGES = 50;
const ARCHIVE_THRESHOLD = 60;  // Archive when exceeding 60

// ... later ...

if (history.length >= ARCHIVE_THRESHOLD) {
  // Archive oldest 20 messages
  const messagesToArchive = history.slice(0, 20);
  const messagesToKeep = history.slice(20);
  
  await prisma.conversationArchive.create({
    data: {
      conversationId: conversation.id,
      messagesSnapshot: messagesToArchive as unknown as Prisma.InputJsonValue,
      archivedAt: new Date()
    }
  });
  
  // Update conversation with recent messages only
  await prisma.conversation.update({
    where: {
      clinicId_clientPhone: { clinicId: clinic.id, clientPhone }
    },
    data: {
      messages: messagesToKeep as unknown as Prisma.InputJsonValue
    }
  });
  
  history = messagesToKeep;
}
```

### Retrieve Full History
```typescript
export async function getFullConversationHistory(conversationId: string, clientPhone: string) {
  // Fetch all archives
  const archives = await prisma.conversationArchive.findMany({
    where: { conversationId },
    orderBy: { archivedAt: "asc" }
  });
  
  // Fetch current messages
  const current = await prisma.conversation.findUnique({
    where: { clinicId_clientPhone: { clinicId, clientPhone } },
    select: { messages: true }
  });
  
  // Reconstruct full history
  const allMessages = [];
  for (const archive of archives) {
    allMessages.push(...(archive.messagesSnapshot as unknown as ChatMessage[]));
  }
  if (current?.messages) {
    allMessages.push(...(current.messages as unknown as ChatMessage[]));
  }
  
  return allMessages;
}
```

---

## FIX #8: Monitor Knowledge Base Indexing (2 hours)

### Current Code (KnowledgeIndexingService.ts)
```typescript
} catch (error) {
  console.error("[KnowledgeIndexingService] Failed...", error);
  // Silent fail
}
```

### Recommended Change
```typescript
export class KnowledgeIndexingService {
  static async indexDocument(params: {
    kbId: string;
    clinicId: string;
    category: KbCategory;
    content: string;
  }) {
    try {
      const { kbId, clinicId, category, content } = params;
      const sourceKey = `KB-${kbId}`;
      
      // ... existing logic ...
      
      // Update status to PUBLISHED
      await prisma.knowledgeDocument.update({
        where: { id: docId },
        data: { status: "PUBLISHED" }
      });
      
      console.log(`[KnowledgeIndexingService] Successfully indexed KB-${kbId}`);
    } catch (error) {
      const docId = `KB-${params.kbId}`;
      
      // Mark as FAILED in database
      await prisma.knowledgeDocument.updateMany({
        where: { source: sourceKey, clinicId: params.clinicId },
        data: { status: "FAILED" }
      });
      
      // Log explicitly
      Logger.error(
        `[KnowledgeIndexingService] Failed to index document`,
        error,
        {
          requestId: "kb-indexing",
          clinicId: params.clinicId,
          kbId: params.kbId,
          category: params.category
        }
      );
      
      // Track metric
      Logger.metric("kb_indexing_failure", 1, {
        requestId: "kb-indexing",
        clinicId: params.clinicId,
        errorType: error instanceof Error ? error.constructor.name : "unknown"
      });
      
      // Alert if clustered
      // (handled by monitoring system)
      
      throw error;  // Let caller decide whether to retry
    }
  }
}
```

### UI Feedback
```typescript
// In dashboard KB editor:
const status = knowledgeDoc.status;

if (status === "PUBLISHED") {
  return <Badge color="green">✓ Indexed & searchable</Badge>;
} else if (status === "PROCESSING") {
  return <Badge color="blue">⏳ Indexing...</Badge>;
} else if (status === "FAILED") {
  return <Badge color="red">✗ Indexing failed - try again</Badge>;
}
```

---

## FIX #9: Migrate System Prompt to Database (3 hours)

### Schema Change
```prisma
model Clinic {
  // ... existing fields ...
  
  systemPrompt    String? @db.Text
  systemPromptVersion Int @default(1)
  systemPromptUpdatedAt DateTime?
}
```

### Migration
```bash
npx prisma migrate dev --name add_system_prompt_to_clinic
```

### Load on Startup
```typescript
// lib/infrastructure/ai/PromptLoader.ts
let cachedPrompts: Map<string, { content: string; version: number }> = new Map();

export async function getSystemPrompt(clinicId: string): Promise<string> {
  // Check cache first
  if (cachedPrompts.has(clinicId)) {
    return cachedPrompts.get(clinicId)!.content;
  }
  
  // Fetch from database
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { systemPrompt: true, systemPromptVersion: true }
  });
  
  if (!clinic || !clinic.systemPrompt) {
    // Fallback to default
    return DEFAULT_SYSTEM_PROMPT;
  }
  
  // Cache
  cachedPrompts.set(clinicId, {
    content: clinic.systemPrompt,
    version: clinic.systemPromptVersion
  });
  
  return clinic.systemPrompt;
}

export function invalidatePromptCache(clinicId: string) {
  cachedPrompts.delete(clinicId);
}
```

### Use in AIProvider
```typescript
// AIProvider.ts
export class AIProvider {
  static async classifyIntentAndExtractData(
    clinic: ClinicWithCatalog,
    // ...
  ) {
    // Load system prompt from database (or cache)
    const baseSystemPrompt = await getSystemPrompt(clinic.id);
    
    const systemPrompt = `
${baseSystemPrompt}

اسم العيادة: ${clinic.name}
...
`;
    
    // Rest of logic
  }
}
```

### API Endpoint to Update
```typescript
// POST /api/clinic/config/system-prompt
export async function POST(req: NextRequest) {
  const tenantId = req.headers.get("x-tenant-id");
  const { systemPrompt } = await req.json();
  
  const clinic = await prisma.clinic.update({
    where: { id: tenantId },
    data: {
      systemPrompt,
      systemPromptVersion: { increment: 1 },
      systemPromptUpdatedAt: new Date()
    }
  });
  
  // Invalidate cache
  invalidatePromptCache(tenantId);
  
  return NextResponse.json({ success: true, version: clinic.systemPromptVersion });
}
```

---

## SUMMARY

| Fix # | Time | Difficulty | Impact |
|-------|------|------------|--------|
| 1 | 2h | LOW | CRITICAL (Auth bypass) |
| 2 | 4h | MEDIUM | CRITICAL (Type safety) |
| 3 | 1h | LOW | CRITICAL (Data integrity) |
| 4 | 3h | MEDIUM | HIGH (UX) |
| 5 | 2h | LOW | HIGH (Observability) |
| 6 | 2h | LOW | HIGH (Observability) |
| 7 | 4h | MEDIUM | HIGH (Compliance) |
| 8 | 2h | LOW | HIGH (Observability) |
| 9 | 3h | MEDIUM | MEDIUM (Ops) |
| **Total** | **23h** | | |

**Recommended order:** 1, 2, 3 first (critical), then 4-6 (high impact), then 7-9 (medium, can be deferred).

---

**Note:** These recommendations are structural guidance only. Actual implementation should include:
- Code review by tech lead
- Unit tests for each change
- Integration tests
- Staging deployment verification
- Performance regression testing (if applicable)
