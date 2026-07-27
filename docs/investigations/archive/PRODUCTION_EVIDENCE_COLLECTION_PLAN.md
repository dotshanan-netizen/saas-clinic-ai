# 🔬 Production Proof & Evidence Collection Plan (PRODUCTION_EVIDENCE_COLLECTION_PLAN.md)

## 📌 Executive Purpose
تحويل كافة "المجاهيل" (Unknowns) والملاحظات المعلقة المستخرجة من التقرير الاستجوابي الجنائي إلى **خطة إثبات ميدانية بأدلة الإنتاج (Production Proof Plan)**، وذلك لجمع الأدلة المادية المباشرة من خوادم Vercel و Neon Database ومقارنة السلسلة السداسية للطلب الميداني قبل إجراء أي تعديل جديد على كود منطق الأعمال.

---

## 🆔 1. Unified End-to-End Correlation ID (معرّف التتبع الموحد)

تلتزم جميع المكونات الثمانية في المنظومة بإقران واستخراج **معرّف تتبع موحد (Correlation ID = `wamid` أو `requestId`)** يرافق رسالة واتساب الميدانية من لحظة دخول الـ Webhook إلى لحظة الحفظ في قاعدة البيانات والظهور في الـ Dashboard:

```text
WhatsApp Meta (wamid) ➔ Webhook ➔ AI Provider ➔ ConversationEngine ➔ BusinessEngine ➔ ValidationGate ➔ BookingService ➔ Database & Dashboard
```

هذا المعرّف يضمن سحب السجل الكامل المتسلسل (Complete Trace Chain) لرسالة إنتاجية واحدة دون عناء البحث في سجلات متفرقة.

---

## 📋 2. مصفوفة تحويل المجاهيل إلى أدلة إثبات (Evidence Collection Matrix)

| # | Unknown (المجهول) | الدليل المطلوب (Required Evidence) | المصدر وكيفية الاستخراج (Extraction Source & Method) |
|---|---|---|---|
| **1** | **مطابقة بناء الإنتاج (Build Parity):** هل نسخة Vercel الحالية تنفذ آخر Git Commit؟ | **Build SHA** (Git Commit) + **Env Parity** (`NODE_ENV`, `USE_QUEUE`, `allowedCountries`) + **DB Parity** (Clinic Status) | فحص `/api/health` + Vercel Deployment Settings + Neon Postgres Query |
| **2** | **مسار التشغيل الفعلي (Runtime Path):** أي مسار نفذ رسالة واتساب الميدانية؟ (Sync Webhook vs Async BullMQ Queue) | Runtime Execution Log المقترن بـ **Correlation ID** (`wamid`) | استخراج سجلات Vercel Function Logs / Upstash Redis |
| **3** | **تلوث مخرجات الذكاء الاصطناعي (AI Raw Pollution):** هل يعيد Gemini وقتاً ملوثاً (`05:00 م`) في JSON الخام؟ | AI Raw JSON Response (`aiRaw.bookingData`) المقترن بـ `wamid` | تتبع كائن `ENTITY_EXTRACTION` في سجلات التشغيل السحابية |
| **4** | **حالة البوابات الست (Validation Gate Status):** أي شرط تسبب في منع استدعاء `createBooking()`؟ | ValidationGate Result (`isValid`, `missingFields`, `phoneRestricted`) المقترن بـ `wamid` | تتبع كائن `VALIDATION_RESULT` في سجلات السحاب |
| **5** | **مطابقة السلوت المتاح (Slot Matching State):** هل تم تقييم `cleanTimeSlot` مقابل `availableSlots` بنجاح؟ | Double Booking Guard Log (`slotIsAvailable`, `offeredSlots`) المقترن بـ `wamid` | فحص سجلات مطابقة السلوت المتاح الحية |
| **6** | **تلوث الذاكرة التاريخية (Historical State Leakage):** هل تسربت حالة ملوثة من محادثات سابقة للمريض؟ | DB JSON Messages Array (`currentState.timeSlot`) | استعلام مباشر لجدول `Conversation` في Neon Postgres برقم الجوال |

---

## 🧪 3. السلسلة السداسية للتحقق الميداني (The 6-Stage Trace Chain)

عند وصول رسالة واتساب حية في البيئة الإنتاجية، يتم تتبع السلسلة السداسية التالية المقترنة بـ **Correlation ID**:

```text
[Stage 1: Raw WhatsApp Message]
   ↓ (userMessage, clientPhone, wamid)
[Stage 2: AI Provider Raw JSON Output]
   ↓ (aiResult.bookingData, intent, aiRaw, Correlation ID)
[Stage 3: Historical Conversation State]
   ↓ (currentState from Neon DB, Correlation ID)
[Stage 4: Business Engine Entity Sanitization]
   ↓ (sanitizedData, cleanName, cleanPhone, Correlation ID)
[Stage 5: Validation Gate & Slot Matching]
   ↓ (isValid, missingFields, phoneRestricted, cleanTimeSlot, Correlation ID)
[Stage 6: Booking Creation Decision]
   ↓ (createBooking invoked vs blocked + reason, Correlation ID)
```

---

## ⚖️ 4. Verdict Matrix (مصفوفة الحكم النهائي الحسمية)

تُحول كل فرضية إجبارياً بعد تجميع الأدلة إلى تصنيف دقيق محدد:

| الفرضية (Hypothesis) | الحالة الدقيقة (Precision Status) | الدليل القاطع والتحليل المعماري الميداني |
|---|---|---|
| **1. تنفيذ Vercel لبناء برمجي قديم** | 🟨 **Strongly Supported (مدعومة بقوة برمجياً)** | **استنتاج سلوكي مبني على المخرجات:** عدم فحص Vercel Deployment SHA صراحة يمنع تصنيفها كـ `Proven`. الانحراف مطابق لسلوك التطبيع القديم قبل عزل التاريخ. |
| **2. تسرب الذاكرة التاريخية من جلساتابقة** | 🟦 **Intra-Session Persistence (استمرارية سياقية)** | **سلوك معماري متوقع:** المحادثة `cms0nn1ke0005la048rvo9ge0` هي محادثة واحدة ممتدة (36 رسالة)، ونقل الفرع `الصحافة` هو استمرارية سياق داخل نفس المحادثة وليس تسرباً cross-conversation. |
| **3. حظر الحجز بواسطة حارس المطابقة (Double Booking Guard)** | 🟩 **Proven (مثبتة مائة بالمائة)** | **دليل مادي مفرز:** سجلات Neon DB أظهرت صراحة إرجاع `slotIsAvailable = false` لوقت `05:00 م` ومنع `createBooking()`. |
| **4. تلوث مخرجات الذكاء الاصطناعي (AI Raw Pollution)** | 🟥 **Ruled Out (مستبعدة كلياً)** | **دليل مادي مفرز:** سجلات AI RAW أظهرت استخراج `"10 م"` و `"الساعه 11"` بنجاح من Gemini قبل أدوات التطبيع. |
| **5. انكسار بوابات الاسم والخدمة (Validation Gate Failure)** | 🟥 **Ruled Out (مستبعدة كلياً)** | **دليل مادي مفرز:** السلسلة أظهرت استيفاء الكيانات بنجاح قبل مرحلة الموعد. |
| **6. فشل كود تنفيذ `createBooking()` نفسه** | 🟥 **Ruled Out (مستبعدة كلياً)** | **دليل مادي مفرز:** الدالة لم تُستدعَ أصلًا لأن حارس المطابقة أوقف العملية في المرحلة الخامسة. |

---

## 🏛️ 5. الخطوات التنفيذية الحسمية المعتمدة

1. **الامتناع التام عن تعديل كود بمنطق الأعمال** حتى إكمال استخراج مصفوفة أدلة الإنتاج.
2. **فحص التكافؤ الثلاثي (Triple Parity Check):** استخراج الـ Commit SHA من Vercel API / Health Endpoint، ومطابقة متغيرات البيئة وحالة DB.
3. **تتبع معرّف Correlation ID (wamid)** لرسالة ميدانية حية واحدة وتجميع السلسلة السداسية كاملاً.
4. **عرض التقرير الميداني المادي النهائي** بالنتائج المباشرة قبل مناقشة أو كتابة أي إصلاح كودي جديد.
5. **حسم مصفوفة الحكم النهائي (Verdict Matrix)** بعد الحصول على Commit SHA المباشر.
