# PROJECT_INVENTORY.md: Repository Audit Report

تم إعداد هذا التقرير كجزء من عملية الجرد والتوثيق للمستودع لضمان الوصول إلى بيئة نظيفة ومستقرة قبل بدء الـ Pilot. تم تقسيم العمل إلى 6 مراحل متتالية وفق البروتوكول المطلوب.

---

## المرحلة الأولى: Inventory (جرد الملفات)

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
  - **تصنيفه:** Candidates for Archive.

* **`src/lib/domain/response/ResponseBuilder.ts`**
  - **الوظيفة:** بناء صياغة الردود بشكل منظم (ملف قديم).
  - **نشط؟** لا.
  - **يستدعيه:** لا أحد.
  - **تصنيفه:** Candidates for Archive.

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
  - **تصنيفه:** Active Supporting (موقوف خلف Feature Flag).

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

* **`src/app/api/auth/login/route.ts`**
  - **الوظيفة:** واجهة تسجيل دخول إدارية للتطوير والـ MVP.
  - **نشط؟** نعم (بشكل مؤقت).
  - **تصنيفه:** Active Supporting.

* **`src/app/api/bookings/route.ts`**
  - **الوظيفة:** تحديث حالات المواعيد (تأكيد/إلغاء) من قبل موظف الاستقبال عبر الـ Dashboard.
  - **نشط؟** نعم.
  - **تصنيفه:** Active Supporting.

* **`src/app/api/clinic/config/route.ts`**
  - **الوظيفة:** قراءة وتحديث إعدادات وتخصيصات العيادة.
  - **نشط؟** نعم.
  - **تصنيفه:** Active Supporting.

* **`src/app/api/conversations/route.ts`**
  - **الوظيفة:** جلب قائمة المحادثات النشطة وتحديث الرسائل في لوحة التحكم.
  - **نشط؟** نعم.
  - **تصنيفه:** Active Supporting.

---

### 4. واجهة المستخدم والخدمات (UI & Front-end Services)
* **`src/app/dashboard/page.tsx`**: لوحة تحكم المحادثات والحجوزات الحية للعيادة. (نشط)
* **`src/app/dashboard/settings/page.tsx`**: صفحة إعدادات الفروع والأطباء والخدمات والـ KB. (نشط)
* **`src/components/dashboard/settings/*`**: حزمة المكونات (Forms & Tables) لتحديث الفروع والخدمات وتفعيل الـ AI والعملات. (نشط)
* **`src/services/*`**: الطبقة الوسيطة (BranchService, CatalogService, ClinicService, KnowledgeBaseService) للربط مع قاعدة البيانات. (نشط)
* **`src/repositories/*`**: تطبيق نمط الـ Repository لربط الكود بقاعدة بيانات Prisma. (نشط)

---

### 5. ملفات المهام الإضافية (Scripts & Temporary Tools)
* **`src/scripts/worker.ts`**: ملف الـ BullMQ Worker المستقل (غير مستخدم حالياً بسبب تجميد الـ Queue). (Development Tool / Legacy)
* **`scratch/`**: مجلد يحتوي على تجارب فحص الهواتف والتحقق من Meta وربط الـ Database يدوياً. (Development Tool / Temporary)
* **`playwright-tests/`**: ملفات الفحص الآلي للـ UI والـ APIs. (Active Supporting)

---

## المرحلة الثانية: Dependency Mapping (خريطة العلاقات)

### أ. تدفق الرسائل الواردة من المريض (Inbound Flow):
```
Patient (WhatsApp App)
        ↓
Meta Cloud API Webhook
        ↓
[POST] /api/webhook/whatsapp/route.ts
        ↓
[IF USE_QUEUE=false] ───→ ConversationEngine.processMessage()
        │                              ↓
        │                    AIProvider.classifyIntent()
        │                              ↓
        │                    BusinessEngine.processIntent() ──→ RAGPipeline.retrieve()
        │                              ↓                                  ↓
        │                    Prisma DB (Upsert)                 AIProvider.generate()
        │                              ↓
        │                    Meta Graph Messages API
        │
[IF USE_QUEUE=true] ────→ BullMQJobDispatcher.ts
                                       ↓
                                   Redis Queue
                                       ↓
                                  worker.ts (Process message)
```

### ب. تدفق لوحة التحكم للعيادة (Dashboard Flow):
```
Receptionist (Browser Dashboard)
        ↓
[GET] /api/conversations/route.ts
        ↓
ClinicService.ts / CatalogService.ts
        ↓
Prisma SQL DB
```

---

## المرحلة الثالثة: Duplicate Detection (التكرار والأكواد الميتة)

1. **كود ميت (Dead Code):**
   * `src/lib/domain/policies/PolicyEngine.ts` (لا يتم استدعاؤه)
   * `src/lib/domain/response/ResponseBuilder.ts` (لا يتم استدعاؤه)
   * `src/lib/events.ts` (لا يتم استدعاؤه)
2. **ملفات مؤرشفة أو تجريبية (Temporary Scripts):**
   * مجلد `scratch/` بالكامل يحتوي على 18 سكربت للاختبارات الفردية المنتهية.
   * ملفات `scripts/verify-phase*` بالكامل.
3. **مكونات لوحة تحكم غير مستخدمة (Unused Components):**
   * لا يوجد مكونات مكررة، المكونات المتواجدة في `src/components/dashboard/settings/` مستخدمة في صفحة الإعدادات.

---

## المرحلة الرابعة: Classification (تصنيف الملفات)

### A. Core Production (الملفات المحمية بالـ Stable Baseline)
- `src/app/api/webhook/whatsapp/route.ts`
- `src/lib/domain/ConversationEngine.ts`
- `src/lib/domain/BusinessEngine.ts`
- `src/lib/infrastructure/ai/AIProvider.ts`
- `src/lib/domain/RAGPipeline.ts`
- `src/lib/auth.ts`
- `src/middleware.ts`
- `prisma/schema.prisma`

### B. Active Supporting Files (الواجهة والخدمات النشطة)
- `src/app/dashboard/` (صفحات لوحة التحكم)
- `src/components/dashboard/` (المكونات المرئية)
- `src/services/` & `src/repositories/` (طبقة البيانات والخدمات)
- `playwright-tests/` (الفحوصات التلقائية للسلامة)

### C. Development Tools (ملفات وأدوات التطوير)
- `tsconfig.json`, `next.config.ts`, `package.json`
- `eslint.config.mjs`, `postcss.config.mjs`

### D. Temporary Scripts (سكربتات تجريبية مؤقتة)
- مجلد `scratch/` بالكامل
- `src/scripts/check-msg.ts`, `check-sender.ts`, `dump-history.ts`, `find-message.ts`

### E. Legacy (أكواد سابقة لم تعد مفعلة)
- `src/scripts/worker.ts` (معطل لعدم استخدام الـ Queue)
- `src/lib/infrastructure/queue/BullMQJobDispatcher.ts` (موقوف خلف Feature Flag)

### F. Candidates for Archive (ملفات جاهزة للنقل للأرشيف)
- `src/lib/domain/policies/PolicyEngine.ts`
- `src/lib/domain/response/ResponseBuilder.ts`
- `src/lib/events.ts`
- `scripts/verify-phase1.*`, `verify-phase2.*`, `verify-takeover-safety.*`

---

## المرحلة الخامسة: Archive Plan (خطة الأرشفة المقترحة)
عند الموافقة، سيتم نقل الملفات من القسم (F) إلى مجلد `archive/` في جذر المشروع كالتالي:
* `src/lib/domain/policies/PolicyEngine.ts` → `archive/lib/domain/policies/PolicyEngine.ts`
* `src/lib/domain/response/ResponseBuilder.ts` → `archive/lib/domain/response/ResponseBuilder.ts`
* `src/lib/events.ts` → `archive/lib/events.ts`
* `scripts/verify-*` → `archive/scripts/`

*(سيتم الاحتفاظ بكامل الـ Git History لهذه الملفات عبر استخدام `git mv` عند تشغيل الأرشفة).*

---

## المرحلة السادسة: Documentation (التوثيق النهائي)
تم توليد ملف التوثيق المعتمد وتخزينه كـ Artifact رسمي في جذر المشروع باسم:
> **[PROJECT_INVENTORY.md](file:///C:/Users/20101/saas-clinic-ai/PROJECT_INVENTORY.md)** ✅
