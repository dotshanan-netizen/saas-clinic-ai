# PHASE 0 EXECUTION PACKAGE

> **مرجع الاعتماد الوحيد لـ Phase 0 — Architecture Refactoring**
>
> هذه الوثيقة تغني عن 4 وثائق منفصلة. تحتوي على:
> 1. **Architecture Acceptance Criteria** — تعريف النجاح لكل Phase
> 2. **Performance Baseline** — القياسات قبل وبعد
> 3. **Rollback Strategy** — الخروج الآمن لكل Phase
> 4. **Regression Matrix** — ما يبقى صحيحًا بعد كل تغيير

---

# SECTION 1 — Architecture Acceptance Criteria

## Phase A — Time & Golden Tests

| البند | المحتوى |
|---|---|
| **الهدف** | إثبات أن غياب الـ Timezone هو السبب الجذري لمشاكل الـ Slot Matching، واستبدال الـ String Time بكائن منظم (CanonicalSlotObject)، وإنشاء شبكة أمان اختبارية قبل أي تغيير |
| **Definition of Done** | 1. تقرير Timezone Investigation يثبت الفرضية أو ينفيها<br>2. `CanonicalSlotObject` منشأ ومستخدم في `TimeNormalizer.normalize()`<br>3. `Golden Tests` مجموعة اختبارات E2E تمر قبل أي تغيير وبعده |
| **Success Criteria** | 1. `TimeNormalizer.normalize()` يُرجع `CanonicalSlotObject` بدل `string`<br>2. Golden Tests تغطي 13 feature (حسب Regression Matrix أدناه)<br>3. Double-Booking Guard يستخدم `slotDate + slotTime` بدل regex scraping<br>4. كل الاختبارات الموجودة (61) تمر بدون تغيير |
| **Exit Criteria** | 1. الـ Architect يوافق على CanonicalSlotObject schema<br>2. Golden Tests كلها Green<br>3. Performance Baseline مسجل للـ Metrics المطلوبة |
| **Artifacts Produced** | • `docs/investigations/PHASE_A_HYPOTHESES.md` — فرضيات Timezone قبل الإثبات<br>• `docs/investigations/PHASE_A_ROOT_CAUSE.md` — تقرير السبب الجذري بعد الإثبات<br>• `src/__tests__/golden/` — مجموعة Golden Tests (أتمتة) |

---

## Phase B — State Ownership & Source of Truth

| البند | المحتوى |
|---|---|
| **الهدف** | إنشاء `bookingDraft` منفصل عن `Conversation.messages`، وتحديد Ownership لكل قطعة State، وفرض SST واحدة لكل كيان |
| **Definition of Done** | 1. `bookingDraft` كيان منفصل (جدول جديد أو حقل JSON في Conversation منفصل عن messages)<br>2. `currentState` في ConversationEngine يُقرأ من `bookingDraft` وليس من history walk<br>3. لا يوجد قطعة State لها مصدران متناقضان |
| **Success Criteria** | 1. `currentState` في ConversationEngine لم يعد يُعاد بناؤه من history (أسطر 161-202)<br>2. `bookingDraft` له دورة حياة واضحة (إنشاء، تحديث، حذف عند booking created/timeout)<br>3. كل الاختبارات تمر (Golden Tests + الـ 61 الموجودة)<br>4. Metrics تُظهر تحسنًا أو استقرارًا في latency (لم يزد) |
| **Exit Criteria** | 1. الـ SST table من `PHASE_0_EXECUTION_PACKAGE` مطبّق بالكامل<br>2. لا يوجد قطعة State تتغير من مكانين مختلفين بدون قواعد صريحة<br>3. Architect يوافق على Ownership Map الجديدة |
| **Artifacts Produced** | • Prisma Migration: `booking_draft` table (أو حقل منفصل في Conversation)<br>• `docs/architecture/STATE_OWNERSHIP_MAP.md` — الخريطة النهائية لـ Ownership<br>• Golden Tests المحدثة (R2, R3, R4, R8, R9, R11) |

---

## Phase C — Duplicate Logic Removal & Abstractions

| البند | المحتوى |
|---|---|
| **الهدف** | إزالة 6 حالات Duplicate Logic (TD-24 → TD-29)، وإنشاء Shared Utilities، وتجريد Meta API layer |
| **Definition of Done** | 1. `normalizeToOfficial()` موجودة في مكان واحد فقط<br>2. أسماء الشهور العربية في مكان واحد<br>3. WhatsApp Meta API reply في `WhatsAppMessenger` واحد (ليس 3 نسخ)<br>4. Clinic fetch shape موحّد (shared query builder أو Repository pattern) |
| **Success Criteria** | 1. TD-24, TD-25, TD-26, TD-27, TD-28, TD-29 مقفولة<br>2. Meta API تستخدم class واحد (`WhatsAppMessenger.sendText()`) بدل fetch مكرر<br>3. Golden Tests كلها تمر<br>4. Latency لم يزد |
| **Exit Criteria** | 1. لا يوجد normalizeToOfficial مكرر (لا في types.ts ولا BusinessEngine.ts)<br>2. لا يوجد fetch مكرر لـ Meta API<br>3. لا يوجد تعريف مكرر لأسماء الشهور |
| **Artifacts Produced** | • `src/lib/infrastructure/messaging/WhatsAppMessenger.ts` — class موحّد<br>• `src/lib/shared/normalizeToOfficial.ts` — shared utility<br>• `src/lib/shared/arabicTime.ts` — موحّد لأسماء الشهور والتوقيت |

---

## Phase C.5 — Intent Routing Cleanup & Circular Dependencies

| البند | المحتوى |
|---|---|
| **الهدف** | حذف الـ Regex-based Intent Overrides (6 من 10 regexes تتنافس مع LLM)، وفك الـ Circular Dependency الذي يسبب Dynamic Imports |
| **Definition of Done** | 1. BusinessEngine لم يعد يغير `resolvedIntent` بناءً على keyword regex<br>2. ConversationEngine لم يعد يستخدم dynamic `import()`<br>3. Circular Dependency بين ConversationEngine ↔ BookingService محلولة |
| **Success Criteria** | 1. لا يوجد سطر في BusinessEngine يرفع Intent من Inquiry إلى BookAppointment عبر regex (TD-4, TD-5, TD-6 محذوفة)<br>2. ConversationEngine يستخدم top-level imports<br>3. Golden Tests كلها تمر — خاصة Context Switching و Arabic Variants |
| **Exit Criteria** | 1. الـ Architect يوافق على أن "Intent يحدده AI فقط" أو يقرر الآلية الجديدة<br>2. لا dynamic import في ConversationEngine<br>3. كل الاختبارات تمر |
| **Artifacts Produced** | • `docs/architecture/INTENT_ROUTING_DECISION.md` — الـ decision record النهائي لسياسة الـ Intent<br>• `src/lib/domain/ConversationEngine.ts` — بدون dynamic imports |

---

## Phase D — Explicit FSM

| البند | المحتوى |
|---|---|
| **الهدف** | بناء FSM صريح (Explicit State Machine) يحل محل الشرط المتناثر في ConversationEngine + BusinessEngine |
| **Definition of Done** | 1. FSM class منفصل (لا يعتمد على `if/else` في ConversationEngine)<br>2. Allowed Transitions مطبّقة حسب المصمم في Architecture Plan<br>3. Session Expiry Rules (15 min, 24 hr, 50 msg) مطبّقة في FSM<br>4. JourneyResolver يُستبدَل بـ FSM أو يصبح decorator |
| **Success Criteria** | 1. كل مسار في FSM له `state + event → nextState`<br>2. لا يوجد شرط مبعثر في ConversationEngine يقرر الـ stage<br>3. Session Timeout و Session Expiry يعملان حسب القواعد<br>4. Golden Tests كلها تمر |
| **Exit Criteria** | 1. FSM يمر بكل انتقالات Allowed Transitions بنجاح<br>2. الـ Architect يوافق على FSM completeness<br>3. كل الاختبارات تمر |
| **Artifacts Produced** | • `src/lib/domain/fsm/SessionFSM.ts` — FSM class<br>• `src/lib/domain/fsm/FSMTransitions.ts` — جدول الانتقالات<br>• `docs/architecture/FSM_SPECIFICATION.md` — توثيق الـ FSM الكامل |

---

# SECTION 2 — Performance Baseline

## Metrics المطلوب قياسها

| # | Metric | الوصف | طريقة القياس | الأداة |
|---|---|---|---|---|
| M1 | **webhook_latency_ms** | زمن استجابة Webhook (من POST إلى 200) | `Date.now()` قبل وبعد | مدمجة (Logger) |
| M2 | **ai_latency_ms** | زمن `AIProvider.classifyIntentAndExtractData()` | `Date.now()` في ConversationEngine قبل/بعد | `Logger.metric("llm_latency_ms", ...)` — موجود |
| M3 | **business_latency_ms** | زمن `BusinessEngine.processIntent()` | `Date.now()` قبل وبعد | جديد — يضاف |
| M4 | **db_read_latency_ms** | زمن قراءات Prisma (findUnique, findFirst) | `Date.now()` قبل وبعد كل استعلام | جديد — يضاف |
| M5 | **slot_generation_latency_ms** | زمن `BookingService.getAvailableSlots()` | `Date.now()` في ConversationEngine قبل/بعد | جديد — يضاف |
| M6 | **total_latency_ms** | إجمالي `processMessage()` | `Date.now()` في ConversationEngine | `Logger.metric("total_latency_ms", ...)` — موجود |
| M7 | **history_rebuild_latency_ms** | زمن إعادة بناء currentState من history | `Date.now()` حول الأسطر 161-202 | جديد — للـ Phase B |
| M8 | **fallback_rate** | نسبة الـ AI fallbacks لكل 100 request | `Logger.metric("fallback_triggers", ...)` | مدمجة |
| M9 | **error_rate** | نسبة الأخطاء لكل 100 request | `Logger.metric("error_count", ...)` | مدمجة |
| M10 | **token_usage** | متوسط tokens لكل request | `Logger.metric("prompt_tokens"/"completion_tokens", ...)` | مدمجة |

## طريقة القياس

1. **قبل أي تغيير**: تشغيل Golden Tests (13 سيناريو) مع تسجيل الـ 10 Metrics
2. **بعد كل Phase**: تشغيل Golden Tests مع نفس الـ Metrics
3. **المقارنة**: `(بعد — قبل) / قبل × 100` نسبته المئوية

## أدوات القياس

- `Logger.metric()` — موجود، يُسجل في `MetricLog` table + stdout
- **جديد**: نصيف `histogram` لكل Metric (min, max, avg, p50, p95, p99)
- **جديد**: Dashboard Metric Log query للتصدير

## Baseline الحالي

> **هام**: التصنيف الدقيق للـ Baseline يمنع الخلط بين الأرقام المُقاسة والأرقام المقدّرة.

| المصطلح | المعنى |
|---|---|
| **Observed Baseline** | رقم مُقاس فعليًا من تشغيل الـ Golden Tests على الوضع الحالي |
| **Target Baseline** | رقم مستهدف (تقديري) لم يُقاس بعد — يجب تأكيده قبل اعتباره Observed |

| Metric | النوع | القيمة | المصدر |
|---|---|---|---|
| ai_latency_ms | **Target Baseline** | 2,000-5,000 ms | من Logger threshold warning عند 3,000 ms (غير مُقاس مباشرة) |
| total_latency_ms | **Target Baseline** | 2,500-6,000 ms | من Logger threshold warning عند 5,000 ms |
| fallback_rate | **Target Baseline** | 5-10% | تقديري — لم يُسجل قبلًا |
| error_rate | **Target Baseline** | 2-5% | تقديري |
| slot_generation_latency_ms | **Target Baseline** | 50-300 ms | تقديري (حسب عدد الأطباء) |
| history_rebuild_latency_ms | **Target Baseline** | 1-5 ms | تقديري |

> **قبل بدء Phase A مباشرة**: يجب تشغيل Golden Tests وجمع الـ 10 Metrics لتسجيل **Observed Baseline**. عندها فقط تتحول الـ Target Baselines أعلاه إلى Observed.
>
> الـ Observed Baseline يُرفق بـ `docs/investigations/PHASE_A_BASELINE_REPORT.md`.

## ما يعتبر تحسنًا

| Phase | Metric الهدف | عتبة التحسن |
|---|---|---|
| Phase A | slot_generation_latency_ms | لا يزداد > 10% (التغيير في التنسيق فقط) |
| Phase B | history_rebuild_latency_ms | **ينخفض > 90%** (من 5ms إلى < 0.5ms) لأن state لم يعد يُعاد بناؤه |
| Phase B | total_latency_ms | ينخفض > 5% (أقل قراءة DB) |
| Phase C | total_latency_ms | لا يزداد (تغيير بنائي فقط، لا منطق) |
| Phase C.5 | total_latency_ms | ينخفض > 10% (إلغاء dynamic imports + regex overhead) |
| Phase D | — | استقرار (FSM لا يُحسّن latency مباشرة لكن يمنع الأخطاء) |

---

# SECTION 3 — Rollback Strategy

## Phase A — Time & Golden Tests

| البند | المحتوى |
|---|---|
| **Preconditions** | 1. Performance Baseline مسجل قبل التغيير<br>2. Golden Tests مجموعة ومشغلة (كلها Green)<br>3. Branch: `refactor/phase-a-time` |
| **Rollback Trigger** | 1. Golden Tests فشلت بعد التغيير (أي سيناريو)<br>2. `total_latency_ms` زاد > 15% عن Baseline<br>3. Double-Booking Guard أخطأ في Production-simulation |
| **Rollback Steps** | 1. `git revert` commit الخاص بـ CanonicalSlotObject<br>2. `git revert` commit الخاص بـ TimeNormalizer<br>3. `npm run build` → يجب أن ينجح<br>4. `npm test` → يجب أن تمر كل الاختبارات (61 + Golden) |
| **Validation After Rollback** | 1. TimeNormalizer.normalize() يُرجع string (كما كان)<br>2. Double-Booking Guard يستخدم regex scraping القديم<br>3. كل الـ 10 Metrics عادت إلى Baseline |
| **Data Integrity Validation** | 1. لا يوجد Booking مكرر (check `booking.timeSlot` uniqueness patterns)<br>2. لا يوجد Conversation مكسورة (messages JSON صالح)<br>3. لا يوجد `bookingDraft` orphan (لا ينطبق — لم يُنشأ بعد)<br>4. Double-Booking Guard لا ينتج false positives |

---

## Phase B — State Ownership & Source of Truth

| البند | المحتوى |
|---|---|
| **Preconditions** | 1. Golden Tests كلها Green قبل البدء<br>2. جدول `bookingDraft` (أو ما يعادله) script rollback جاهز<br>3. Branch: `refactor/phase-b-state` |
| **Rollback Trigger** | 1. `history_rebuild_latency_ms` لم يتحسن (أي بقى كما هو)<br>2. Golden Tests فشلت (خاصة Booking و Cancel)<br>3. تم اكتشاف State Leak (booking fields من جلسة سابقة) |
| **Rollback Steps** | 1. Prisma: `DROP TABLE IF EXISTS booking_draft;` (أو revert migration)<br>2. `git revert` commit الذي أزال history walk من ConversationEngine<br>3. إعادة `currentState` reconstruction إلى ConversationEngine.ts:161-202<br>4. `npm run build && npm test` |
| **Validation After Rollback** | 1. history walk يعمل كما كان سطر 161-202<br>2. currentState يُملأ بشكل صحيح<br>3. كل Golden Tests تمر |
| **Data Integrity Validation** | 1. لا يوجد `bookingDraft` orphan (إذا كان الجدول موجودًا، كل السجلات يجب حذفها أو ترحيلها)<br>2. لا يوجد Conversation تفقد data بعد إزالة bookingDraft<br>3. `currentState` في ConversationEngine يعيد نفس النتائج السابقة (مقارنة قبل/بعد)<br>4. كل الـ Sessions النشطة يمكنها الاستمرار بعد الـ Rollback |

---

## Phase C — Duplicate Logic Removal & Abstractions

| البند | المحتوى |
|---|---|
| **Preconditions** | 1. Golden Tests كلها Green<br>2. لكل extract/refactor commit، الـ old code محفوظ (git commit منفصل)<br>3. Branch: `refactor/phase-c-duplication` |
| **Rollback Trigger** | 1. أي Golden Test فشل<br>2. WhatsApp reply فشل في إرسال الرسالة<br>3. normalizeToOfficial أعطى نتيجة مختلفة عن السابق |
| **Rollback Steps** | 1. `git revert` commit الخاص بـ WhatsAppMessenger abstraction<br>2. `git revert` commit الخاص بـ normalizeToOfficial merge<br>3. `git revert` commit الخاص بـ month names dedup<br>4. إعادة الـ 3 نسخ من Meta API fetch كما كانت<br>5. `npm run build && npm test` |
| **Validation After Rollback** | 1. normalizeToOfficial في place واحد فقط (أو مكانين كما كان)<br>2. Meta API تستخدم fetch مباشر (ليس class)<br>3. كل Golden Tests تمر |
| **Data Integrity Validation** | 1. لا يوجد رسائل WhatsApp فُقدت أثناء فترة التبديل (check logs)<br>2. normalizeToOfficial يُرجع نفس النتائج لـ 50 sample عشوائي (قبل/بعد)<br>3. لا يوجد Clinic fetch ينتج بيانات مختلفة عن السابق |

---

## Phase C.5 — Intent Routing Cleanup & Circular Dependencies

| البند | المحتوى |
|---|---|
| **Preconditions** | 1. Golden Tests كلها Green<br>2. الـ Regex Intent Overrides موثقة (أي Override سيُحذف، له commit منفصل)<br>3. Branch: `refactor/phase-c5-intent` |
| **Rollback Trigger** | 1. Intent قراره خطأ في أي Golden Test (خاصة Context Switching, Arabic Variants)<br>2. Circular Dependency ظهرت من جديد (dynamic import ضروري)<br>3. `total_latency_ms` زاد (نتيجة Restructuring خطأ) |
| **Rollback Steps** | 1. `git revert` commits التي حذفت الـ Regex overrides<br>2. إعادة BusinessEngine intent logic إلى حالتها السابقة<br>3. إعادة dynamic imports إلى ConversationEngine<br>4. `npm run build && npm test`<br>5. التأكيد: ConversationEngine. بما في ذلك dynamic imports |
| **Validation After Rollback** | 1. Intent overrides تعمل كما كانت (حتى لو كانت خاطئة — الـ rollback يعيد الحالة القديمة)<br>2. dynamic imports موجودة<br>3. كل Golden Tests تمر |
| **Data Integrity Validation** | 1. لا يوجد Booking غير متوقع بعد الـ Rollback (check bookings created during overlap)<br>2. Intent Distribution قبل وبعد الـ Rollback متطابقة (لـ 100 رسالة اختبارية)<br>3. لا يوجد Circular Dependency يظهر كـ runtime error بعد إزالة dynamic imports |

---

## Phase D — Explicit FSM

| البند | المحتوى |
|---|---|
| **Preconditions** | 1. كل Phases A → C.5 كاملة ومستقرة على Main<br>2. Golden Tests كلها Green<br>3. FSM مصمم ومراجع من Architect<br>4. Branch: `refactor/phase-d-fsm` |
| **Rollback Trigger** | 1. أي حالة FSM لم تنتقل كما هو متوقع<br>2. Session Expiry لم يعمل (15 min, 24 hr)<br>3. JourneyResolver اختلفت نتائجه عن FSM الجديد<br>4. Golden Tests فشلت |
| **Rollback Steps** | 1. `git revert` commits الخاصة بـ FSM class<br>2. إعادة JourneyResolver إلى state السابق<br>3. إعادة if/else chains إلى ConversationEngine<br>4. `npm run build && npm test` |
| **Validation After Rollback** | 1. JourneyResolver.resolveStage() يعطي نفس النتائج السابقة<br>2. ConversationEngine not use FSM class<br>3. كل Golden Tests تمر |
| **Data Integrity Validation** | 1. لا يوجد Session عالقة في state غير معروف بعد الـ Rollback<br>2. كل الـ Sessions النشطة أثناء الـ FSM التجريبي تعود إلى JourneyResolver القديم بدون فقدان<br>3. لا يوجد state transition مسجل في DB من FSM الجديد يسبب تناقضًا بعد الرجوع |

---

# SECTION 4 — Regression Matrix

> **ملاحظة**: `[NEW]` تعني Golden Test يجب إنشاؤه. `[EXISTS]` تعني موجود في `src/__tests__/`.

| # | Feature | Golden Test | Expected Behaviour | Regression Risk | Priority | Automation Status | Covered In |
|---|---|---|---|---|---|---|---|
| R1 | **Booking (كامل)** | `[EXISTS]` pilot_stabilization_sprint.test.ts<br>`[NEW]` golden_create_booking | بيانات الحجز الخمسة (الاسم، الجوال، الخدمة، الطبيب، الفرع، الوقت) تصل إلى DB كـ PENDING | انهيار تدفق الحجز بالكامل | 🔴 P0 | Planned → Automated (Phase A) | Phase A, B, D |
| R2 | **Booking (جزئي)** | `[NEW]` golden_partial_booking | المستخدم يرسل بيانات ناقصة → النظام يطلب الباقي بدون Hallucinate | AI يؤكد الحجز قبل اكتمال البيانات | 🔴 P0 | Planned → Automated (Phase A) | Phase A, C.5 |
| R3 | **Modify Booking** | `[NEW]` golden_modify_booking | تعديل حجز قائم (خدمة، طبيب، وقت) يحدث في DB | التعديل يمسح الحجز القديم بدل تحديثه | 🔴 P0 | Planned → Automated (Phase B) | Phase B, D |
| R4 | **Cancel Booking** | `[NEW]` golden_cancel_booking | إلغاء حجز قائم ← status=CANCELLED في DB | الإلغاء يمسح السجل بدل تحديث status | 🟡 P1 | Planned → Automated (Phase B) | Phase B, D |
| R5 | **Availability Query** | `[NEW]` golden_availability_query | "عندك موعد مع الدكتور X الأسبوع الجاي؟" → الرد يعرض slots بدون تغيير intent | Availability Query تتحول إلى Booking Request | 🔴 P0 | Planned → Automated (Phase A) | Phase A, C.5 |
| R6 | **Time Parsing** | `[NEW]` golden_time_parsing_table | جدول اختبارات لـ 20 صيغة وقت عربية (اليوم، بكرة، الثلاثاء، 12-8-2026، الساعة 3 العصر، إلخ) | TimeNormalizer يُرجع string خاطئ أو null | 🔴 P0 | Planned → Automated (Phase A) | Phase A |
| R7 | **Double Booking** | `[NEW]` golden_double_booking | slot محجوز من مستخدم آخر → "عذراً، هذا الوقت لم يعد متاحاً" | Slot يُحجز مرتين (Double Booking Guard يفشل) | 🔴 P0 | Planned → Automated (Phase A) | Phase A, D |
| R8 | **Human Takeover** | `[NEW]` golden_human_takeover | AI يفشل 3 مرات أو المستخدم يطلب موظف → humanTakeover=true، لا رد AI | Human Takeover لا يعمل أو AI يستمر في الرد | 🔴 P0 | Planned → Automated (Phase B) | Phase B, D |
| R9 | **Session Timeout** | `[NEW]` golden_session_timeout | 15 دقيقة بدون رسالة → SESSION_TIMEOUT_RESET، state يمسح | State قديم يعود بعد الـ Timeout | 🔴 P0 | Planned → Automated (Phase B) | Phase B, D |
| R10 | **Long Conversations** | `[NEW]` golden_long_conversation | 55 رسالة → MAX_DB_MESSAGES=50 يمسح الأقدم، لا يؤثر على الـ FSM | History يتجاوز 50 فتنهار الـ state | 🟡 P1 | Planned → Automated (Phase B) | Phase B |
| R11 | **Greetings** | `[NEW]` golden_greeting | "السلام عليكم" → Inquiry/Idle، لا تلوث من جلسة سابقة | تلوث State من جلسة حجز سابقة (Bug 11→07) | 🔴 P0 | Planned → Automated (Phase B) | Phase B, D |
| R12 | **Context Switching** | `[NEW]` golden_context_switch | مستخدم: حجز → "شكراً" → "كم سعر البوتكس؟" → Inquiry، لا يعود للحجز | Intent يعلق في BookAppointment بعد switch | 🔴 P0 | Planned → Automated (Phase C.5) | Phase C.5, D |
| R13 | **Arabic Variants** | `[NEW]` golden_arabic_variants | لهجات: "ابغى", "أبي", "حابة", "بدي", "عايز", "نفسي في", "ودي" → كلها تصل إلى Booking Intent | لهجة معينة لا تُفهم → تذهب إلى Unknown | 🟡 P1 | Planned → Automated (Phase C.5) | Phase C.5 |
| R14 | **Phone Extraction** | `[NEW]` golden_phone_extraction | "+966501234567", "0501234567", "966501234567", "0555555555" → كلها تنتج E.164 صحيح | Phone Validation يرفض رقم صحيح أو يقبل رقم خاطئ | 🟡 P1 | Planned → Automated (Phase B) | Phase B |
| R15 | **RAG Pipeline** | `[NEW]` golden_rag_query | "هل تقبلون التأمين؟" → RAGPipeline.retrieve() → grounded response بدون Hallucination | RAG يعطي إجابة من خياله (NO_INFO bypass) | 🟡 P1 | Planned → Automated (Phase C) | Phase C |
| R16 | **Slot Availability Format** | `[NEW]` golden_slot_format | BookingService يُرجع slots بالتنسيق: "الأحد (26 يوليو) 10:00 ص" ← Double-Booking Guard يقرأها صح | Slot format يتغير بعد CanonicalSlotObject ولا يقرأه Guard | 🔴 P0 | Planned → Automated (Phase A) | Phase A |

---

## Regression Risk Legend

| التصنيف | المعنى |
|---|---|
| 🔴 **P0** | Failure = تجربة مستخدم مكسورة، خسارة حجز، أو خطأ مالي. يمنع الـ Release. |
| 🟡 **P1** | Failure = تجربة مستخدم سيئة، لكن لا خسارة مباشرة. يُصلح في الـ Hotfix التالي. |
| 🟢 **P2** | Failure = إزعاج بسيط، لا تأثير على الحجز أو الـ Revenue. |

---

## Golden Tests Execution Order

1. Golden Tests تُشغل **قبل** أي تغيير (Baseline)
2. **بعد كل Phase**، تُشغل كاملة
3. **قبل أي Rollback**، تُشغل لتأكيد الـ Reason
4. **بعد أي Rollback**، تُشغل لتأكيد الـ Recovery

هذه الـ 16 Golden Test تشكل **شبكة الأمان** التي تسمح بإعادة الهيكلة بثقة. أي Phase لا تمر فيها كل الـ Golden Tests = متروكة.

---

> **انتهت الوثيقة.**
>
> في انتظار مراجعة CTO قبل بدء التنفيذ.
