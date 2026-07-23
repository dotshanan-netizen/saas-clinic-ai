# PROJECT INVENTORY AND STATUS (The Ultimate Truth)

تم استخراج هذه الوثيقة مباشرة من الكود المصدري للمشروع كـ "مصدر وحيد للحقيقة" (Single Source of Truth) دون الاعتماد على الذاكرة أو التخمين.

---

## 1. Executive Summary
- **المنتج:** Clinova AI (SaaS Clinic Receptionist).
- **ما يقدمه:** نظام ذكاء اصطناعي يعمل كموظف استقبال للعيادات عبر واتساب، قادر على فهم النوايا، حجز المواعيد، الإجابة على الأسئلة من الـ Knowledge Base (RAG)، وتحويل المحادثة لموظف بشري عند الحاجة، مع لوحة تحكم (Dashboard) لموظفي الاستقبال لمراقبة الحجوزات.
- **الحالة الحالية:** النظام مستقر وقادر على إدارة الحوارات (End-to-End) وتعديل حالة قاعدة البيانات بسلامة.
- **نسبة الاكتمال:** **90%** (الدليل: المحركات الأساسية، الـ Webhooks، الداتابيز، والـ Dashboard تعمل بالكامل. الـ 10% المتبقية تخص نظام الـ Authentication الدائم والـ Analytics).

---

## 2. Repository Inventory
| المجلد / الملف | الغرض | الاستخدام | التصنيف |
|---|---|---|---|
| `src/lib/domain/` | قلب المشروع (Business & Conversation Engines) | يُستخدم بكثافة | **Core** |
| `src/lib/infrastructure/` | البنية التحتية (AI, Queues, Logging) | يُستخدم بكثافة | **Core** |
| `src/app/api/webhook/` | استقبال رسائل Meta WhatsApp | يُستخدم بكثافة | **Core** |
| `src/scripts/worker.ts` | الـ BullMQ Worker لمعالجة الطابور | يُستخدم | **Core** |
| `prisma/schema.prisma` | تصميم الـ Database | يُستخدم | **Core** |
| `src/app/dashboard/` | لوحة تحكم موظف الاستقبال | يُستخدم | **Support** |
| `src/app/api/auth/` | نظام تسجيل الدخول | وهمي مؤقتاً | **Unfinished** |
| `src/scripts/verify-phase1.*` | ملفات اختبار قديمة | غير مستخدمة | **Archive Candidate** |
| `scratch/` | تجارب وأكواد قديمة | غير مستخدم | **Archive Candidate** |

---

## 3. Core Architecture
**تدفق البيانات (Data Flow):**
1. **WhatsApp Meta:** يرسل رسالة المريض (POST) إلى `api/webhook/whatsapp`.
2. **Webhook:** يتحقق من الـ `X-Hub-Signature` لمنع الاختراق، يسجل الـ `Idempotency` لمنع التكرار، ويدفع الرسالة لـ `BullMQ`. يرجع `200 OK` فوراً.
3. **Queue / Worker:** `worker.ts` يستلم الرسالة، يضع قفلاً (Distributed Lock) برقم المريض لمنع الـ Race Conditions، ويستدعي `ConversationEngine`.
4. **Conversation Engine:** يجلب الـ History، ويرسله لـ `AIProvider`.
5. **AI Layer:** `AIProvider` يحلل النية ويستخرج البيانات (Intent + Entities).
6. **Business Engine:** ينفذ قواعد العمل (إلغاء، حجز، تأكيد) بناءً على النية، ويحدث الـ `Database`. (إذا كانت النية سؤال، يستدعي `RAGPipeline`).
7. **Meta API:** الـ `worker.ts` يرسل النتيجة النهائية عبر Meta Graph API للمريض.

---

## 4. Feature Inventory
| الميزة (Feature) | حالة العمل | مربوطة بالنظام؟ | الدليل من الكود |
|---|---|---|---|
| **AI Intent Detection** | ✅ تعمل | نعم | `AIProvider.ts` |
| **WhatsApp Chat** | ✅ تعمل | نعم | `webhook/whatsapp/route.ts` |
| **Booking System** | ✅ تعمل | نعم | `BusinessEngine.ts` |
| **RAG (Knowledge Base)** | ✅ تعمل | نعم | `RAGPipeline.ts` |
| **Receptionist Dashboard** | ✅ تعمل | نعم | `dashboard/page.tsx` |
| **Idempotency** | ✅ تعمل | نعم | `ProcessedWebhook` (DB) |
| **Authentication** | ❌ غير مكتملة | لا (Mocked) | `api/auth/login/route.ts` (مكتوب عليه TEMPORARY) |
| **Analytics** | ❌ غير موجودة | لا | لا يوجد كود للتحليلات |

---

## 5. UI Inventory
| Screen | Route | Status | Backend Connected | Ready |
|---|---|---|---|---|
| **Receptionist Panel** | `/dashboard` | ✅ Complete | Yes (Conversations & Bookings) | ✅ Yes |
| **Settings** | `/dashboard/settings` | ⚠️ Partial | Yes (Config load) | ⚠️ Partial |
| **Login** | `/login` | ❌ Mocked | No (Uses hardcoded cookie) | ❌ No |

---

## 6. API Inventory
- `POST /api/webhook/whatsapp`: البوابة الرئيسية لاستقبال رسائل المرضى (مؤمنة بـ Signature، تُرسل لـ BullMQ).
- `GET /api/webhook/whatsapp`: للتحقق الأولي من توثيق Meta (Verify Token).
- `GET /api/conversations`: جلب قائمة المرضى والمحادثات لـ Dashboard.
- `POST /api/bookings`: تغيير حالة الحجز من Dashboard (تأكيد، إلغاء).
- `POST /api/auth/login`: (مؤقت) يمنح JWT Token للتطوير فقط.

---

## 7. Database Inventory
الكيانات الأساسية (`prisma/schema.prisma`):
- `Clinic`, `Branch`, `Doctor`, `Service`, `WorkingHour`: تدعم الـ Multi-tenancy.
- `KnowledgeDocument`, `KnowledgeChunk`: تحتوي على `Unsupported("vector(768)")` لخدمة الـ RAG.
- `Booking`: لإدارة الحجوزات (`status: PENDING, CONFIRMED, CANCELLED`).
- `Conversation`: لحفظ الحوارات (ملاحظة: `messages` محفوظة كـ Json، مما قد يسبب ضغطاً في المحادثات الطويلة جداً).
- `JobTracker`, `ProcessedWebhook`: لتتبع الطابور ومنع التكرار.

---

## 8. AI Inventory
- **النموذج المستخدم:** `gemini-2.0-flash-lite`.
- **Conversation Engine:** يدير سياق المحادثة (History Window) ولا يحفظ رسائل الأخطاء التقنية لمنع التلوث (State Pollution).
- **Business Engine:** كلاس عملاق يحتوي على شروط Validation صارمة وخوارزمية Fallback Regex قوية تحسباً لفشل الـ AI في استخراج البيانات.
- **RAG Pipeline:** يستخدم بحث المتجهات (Cosine Similarity `c.embedding <=> $1::vector`) مع طبقة حماية (Grounding) ترفض التأليف وتعيد `NO_INFO` إذا لم تكن الإجابة في المستندات.

---

## 9. Integration Inventory
- **WhatsApp Cloud API:** متصل بالكامل (إرسال واستقبال).
- **Google Gemini:** متصل عبر API (يستخدم لتصنيف النوايا والـ RAG).
- **BullMQ & Redis (Upstash):** متصل بالكامل لإدارة الطوابير المتزامنة وفك ضغط الـ Webhook.
- **PostgreSQL (pgvector):** متصل بالكامل ومجهز لدعم الذكاء الاصطناعي.

---

## 10. Customer Deliverables (ما الذي يستلمه العميل اليوم؟)
لو تم بيع النظام اليوم، سيستلم العميل:
1. **Chatbot ذكي:** يرد على مرضاه 24/7 عبر واتساب العيادة.
2. **Receptionist Dashboard:** صفحة ويب حية (Real-time feel) يرى فيها موظف الاستقبال المحادثات الجارية وتفاصيل الحجوزات المسحوبة من الـ AI ليتخذ قرار الـ (تأكيد / إلغاء).
3. **نظام مبيعات مؤتمت:** يحول استفسارات المرضى إلى طلبات حجز معلقة (Pending).

---

## 11. Unfinished Work (النواقص الفعلية)
1. **نظام تسجيل الدخول (Auth):** كود `api/auth/login/route.ts` هو "TEMPORARY DEVELOPMENT LOGIN ENDPOINT" ويستخدم `slug` فقط للدخول بدون Password فعلي! يجب بناء نظام Auth حقيقي (مثلاً عبر NextAuth أو JWT قوي).
2. **الـ Dashboard Super Admin:** لا توجد شاشة لمدير النظام (أنت) لإضافة عيادات جديدة بسهولة (حالياً تحتاج إضافتها في الداتابيز مباشرة).
3. **التعامل مع الوسائط (Media):** في `route.ts` السطر 59: `Ignoring non-text message`. النظام يتجاهل الصور والصوتيات بصمت تام دون تنبيه المريض.

---

## 12. Dead Code
- مجلد `scratch/` بالكامل.
- ملفات `verify-phase1.cjs` و `verify-phase1.ts`.

---

## 13. Technical Debt
1. **The God Class (`BusinessEngine.ts`)**:
   - **التأثير:** صعوبة إضافة نوايا جديدة مستقبلاً دون تضخم الملف لاختباره.
   - **أولوية الإصلاح:** منخفضة (يعمل بكفاءة حالياً، يُؤجل لما بعد الإطلاق التجاري).
2. **`Conversation.messages` as JSON Array**:
   - **التأثير:** بطء مستقبلي عند زيادة عدد رسائل المحادثة الواحدة فوق 100 رسالة.
   - **أولوية الإصلاح:** متوسطة (يُؤجل حتى يزيد الترافيك).

---

## 14. Production Checklist
- [x] Webhook Idempotency (يمنع الرسائل المكررة).
- [x] Webhook Signature Validation (تأمين ضد الاختراق).
- [x] Queue System (منع سقوط السيرفر تحت الضغط).
- [x] Distributed Lock (منع الـ Race Condition).
- [x] AI Fallback & Grounding (حماية ضد ההلوسة).
- [x] Dashboard UI (جاهزة للاستخدام).
- [ ] Authentication System (غير مكتمل).
- [ ] User Feedback for Media Messages (يتم تجاهل الوسائط بصمت).

---

## 15. Final Verdict (الخلاصة النهائية)
- **ماذا تم إنجازه؟** المعمارية المعقدة جداً (AI, Queue, Webhooks, DB) مبنية بامتياز.
- **ما الذي يمنع الإطلاق؟** فقط نظام الـ **Authentication**؛ لا يمكننا تسليم عميل حقيقي لوحة تحكم تسجيل الدخول الخاص بها مجرد (Bypass).
- **هل يوجد أي جزء يجب إعادة بنائه؟** لا يوجد أجزاء مكسورة، ولكن الـ Auth يحتاج بناء.
- **هل توجد أجزاء يجب عدم لمسها إطلاقاً؟** إياك ولمس هيكلية `RAGPipeline` أو الـ `Queue Worker`؛ إنها تعمل بدقة جراحية.
- **ما أولويات العمل من هذه اللحظة حتى أول عميل؟** 
  1. بناء نظام Login آمن لـ Dashboard العيادات.
  2. توجيه رسالة آلية عند إرسال المريض لمقطع صوتي أو صورة.
  3. الإطلاق! 🚀
