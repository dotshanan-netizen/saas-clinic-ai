# PROJECT_INVENTORY.md: Repository Audit Report

تم إعداد هذا التقرير كجزء من عملية الجرد والتوثيق للمستودع لضمان الوصول إلى بيئة نظيفة ومستقرة قبل بدء الـ Pilot. تم تقسيم العمل إلى 6 مراحل متتالية وفق البروتوكول المطلوب، مع دمج تعديلات إدارة المشروع لتعزيز مستوى الأمان والاستقرار.

---

## أولاً: حالة المكونات وإدارة الاستقرار (Stable Baseline Protection Status)

لتسهيل فهم حالة المكونات وسياستها البرمجية أثناء الـ Pilot، تم حصر النظام في الجدول التالي:

| المكون (Module) | المالك (Owner) | الحالة (Status) | محمي من التعديل؟ (Protected) |
|---|---|---|---|
| **WhatsApp Integration** | Core | Stable | ✅ نعم |
| **AI Processing Layer** | Core | Stable | ✅ نعم |
| **Booking System Logic** | Core | Stable | ✅ نعم |
| **Receptionist Dashboard** | Active | 🚧 قيد العمل | ❌ لا (مفتوح للـ Bugs) |
| **Design System / CSS** | Active | 🚧 قيد العمل | ❌ لا (مفتوح للـ Bugs) |
| **Queueing & Async Jobs** | Legacy | 🚫 معطل | ❌ لا (خلف Feature Flag) |

---

## ثانياً: روابط الاعتمادية الحرجة (Critical Production Dependencies)

تمثل هذه العلاقات الروابط التشغيلية الحرجة التي يقوم عليها عمل النظام في الإنتاج، ويمنع كسرها أو إجراء أي تعديل بنيوي عليها:

### 1. مسار رسائل الواتساب الواردة (Inbound Flow):
```
WhatsApp App (Client Device)
    ↓ (Webhook Payload)
[POST] /api/webhook/whatsapp/route.ts
    ↓
ConversationEngine.ts
    ↓
BusinessEngine.ts
    ↓
RAGPipeline.ts
    ↓
AIProvider.ts (Gemini API)
    ↓
WhatsApp Cloud API (Meta API HTTP POST)
```

### 2. مسار واجهة لوحة التحكم (Dashboard Flow):
```
Receptionist Panel (Browser App)
    ↓ (API Request)
[GET] /api/conversations/route.ts
    ↓
Repositories (Prisma ORM)
    ↓
PostgreSQL Database
```

---

## ثالثاً: Inventory (جرد الملفات البرمجية)

### 1. ملفات النواة والمنطق البرمجي (Core Source Code)

* **`src/lib/domain/ConversationEngine.ts`**
  - **الوظيفة:** إدارة حالة سياق المحادثة، جلب وتحديث سجل الرسائل من قاعدة البيانات، تصنيف النية عبر AIProvider، واستدعاء BusinessEngine.
  - **نشط؟** نعم.
  - **يستدعيه:** `src/app/api/webhook/whatsapp/route.ts` و `src/scripts/worker.ts`.
  - **يستدعي:** `AIProvider.ts` و `BusinessEngine.ts` و `JourneyResolver.ts` و `Logger.ts` و `db.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

* **`src/lib/domain/BusinessEngine.ts`**
  - **الوظيفة:** معالجة منطق الحجز وتأكيده وتعديله وإلغائه، والتحقق من صحة المدخلات، وتوجيه استفسارات الـ RAG.
  - **نشط؟** نعم.
  - **يستدعيه:** `ConversationEngine.ts`.
  - **يستدعي:** `db.ts` و `RAGPipeline.ts` و `Logger.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

* **`src/lib/domain/RAGPipeline.ts`**
  - **الوظيفة:** البحث في قاعدة المعرفة المستندة لمتجهات الـ pgvector وتوليد ردود مدعمة بالحقائق.
  - **نشط؟** نعم.
  - **يستدعيه:** `BusinessEngine.ts`.
  - **يستدعي:** `AIProvider.ts` و `db.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

* **`src/lib/domain/journey/JourneyResolver.ts`**
  - **الوظيفة:** تحديد وحساب مرحلة المريض في مسار رحلة الحجز.
  - **نشط؟** نعم.
  - **يستدعيه:** `ConversationEngine.ts`.
  - **يستدعي:** لا يستدعي ملفات أخرى.
  - **تصنيفه:** جزء من الـ Production (Supporting).

* **`src/lib/domain/policies/PolicyEngine.ts`**
  - **الوظيفة:** محرك السياسات التحذيرية (ملف قديم/هيكل إرشاد).
  - **نشط؟** لا.
  - **يستدعيه:** لا أحد.
  - **تصنيفه:** Candidates for Review After Pilot.

* **`src/lib/domain/response/ResponseBuilder.ts`**
  - **الوظيفة:** بناء صياغة الردود بشكل منظم (ملف قديم).
  - **نشط؟** لا.
  - **يستدعيه:** لا أحد.
  - **تصنيفه:** Candidates for Review After Pilot.

* **`src/lib/auth.ts`**
  - **الوظيفة:** تشفير وفك تشفير الـ JWT وتوليد ملفات الكوكيز للجلسة.
  - **نشط؟** نعم.
  - **يستدعيه:** `src/middleware.ts` و `src/app/api/auth/login/route.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

---

### 2. البنية التحتية والموصلات (Infrastructure & Connections)

* **`src/lib/infrastructure/ai/AIProvider.ts`**
  - **الوظيفة:** الموصل البرمجي مع Google Gemini / OpenAI لتصنيف النوايا واستخراج الحقول وحساب الـ Tokens.
  - **نشط؟** نعم.
  - **يستدعيه:** `ConversationEngine.ts` و `RAGPipeline.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

* **`src/lib/infrastructure/queue/BullMQJobDispatcher.ts`**
  - **الوظيفة:** إدارة طابور مهام BullMQ لرسائل الواتساب الواردة.
  - **نشط؟** معطل مؤقتاً بالـ Feature Flag (نشط كود فقط).
  - **يستدعيه:** `src/app/api/webhook/whatsapp/route.ts`.
  - **تصنيفه:** Candidates for Review After Pilot (موقوف خلف Feature Flag).

* **`src/lib/meta/MetaGraphClient.ts`**
  - **الوظيفة:** إدارة الاتصالات وسحب البيانات وإرسال التنبيهات عبر Meta Graph API.
  - **نشط؟** نعم.
  - **يستدعيه:** `src/app/api/whatsapp/setup/route.ts`.
  - **تصنيفه:** Active Supporting.

---

### 3. مسارات الـ Webhooks والـ APIs (Endpoints)

* **`src/app/api/webhook/whatsapp/route.ts`**
  - **الوظيفة:** استقبال وتوثيق وإرسال طلبات الـ Webhooks القادمة من Meta ومعالجتها متزامناً أو غير متزامن.
  - **نشط؟** نعم.
  - **يستدعيه:** Meta Webhook Requests.
  - **يستدعي:** `db.ts` و `BullMQJobDispatcher.ts` و `ConversationEngine.ts`.
  - **تصنيفه:** جزء أساسي من الـ Production (Core).

---

## رابعاً: Classification (تصنيف الملفات الإجمالي)

* **A. Core Production (لا تلمس):**
  - `src/app/api/webhook/whatsapp/route.ts`
  - `src/lib/domain/ConversationEngine.ts`
  - `src/lib/domain/BusinessEngine.ts`
  - `src/lib/domain/RAGPipeline.ts`
  - `src/lib/infrastructure/ai/AIProvider.ts`
  - `src/lib/auth.ts`
  - `src/middleware.ts`
* **B. Active Supporting Files:**
  - صفحات ومكونات `src/app/dashboard/`
  - طبقة الخدمات وقواعد البيانات `src/services/` & `src/repositories/`
* **C. Candidates for Review After Pilot:**
  - `src/lib/domain/policies/PolicyEngine.ts` (تأجيل المراجعة لبعد الـ Pilot)
  - `src/lib/domain/response/ResponseBuilder.ts` (تأجيل المراجعة لبعد الـ Pilot)
  - `src/lib/events.ts` (تأجيل المراجعة لبعد الـ Pilot)
  - `src/scripts/worker.ts` & `src/lib/infrastructure/queue/BullMQJobDispatcher.ts` (تأجيل المراجعة لبعد الـ Pilot)

---

## خامساً: خطة التجميد والأرشفة (Freeze & Archive Plan)

* **لا يتم نقل أي ملف حالياً:** التزاماً بتوصيات الإدارة، تم إلغاء خطة نقل الملفات لـ `archive/` وتجميدها بالكامل حتى انتهاء الـ Pilot لضمان عدم حدوث أي انقطاع أو كسر غير متوقع في البنية التحتية.
* **تجميد المستودع (Repository Freeze):** يعتبر الـ `main` branch تحت وضع التجميد الكامل، وأي تعديل مستقبلي يجب أن يخضع لبروتوكول الـ Regression Test والـ Branching المستقل.
