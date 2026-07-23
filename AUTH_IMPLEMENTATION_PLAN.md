# Authentication Implementation Plan (SaaS User Auth)

هدف هذه الخطة هو ترقية نظام المصادقة المؤقت في Clinova AI إلى نظام مصادقة حقيقي ومناسب لمعمارية الـ SaaS المتعددة المستأجرين (Multi-tenant).

## 1. التعديلات المقترحة على قاعدة البيانات (Database Schema)
سنقوم بإضافة موديل `User` في `prisma/schema.prisma` لتمكين إنشاء حسابات موظفين مستقلين للعيادة بدلاً من الاعتماد على كلمة مرور واحدة مشتركة.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  role         String   @default("STAFF") // "ADMIN" | "STAFF"
  clinicId     String
  clinic       Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@index([clinicId])
}
```

## 2. إدارة كلمات المرور بأمان
سنستخدم مكتبة Node.js الأصلية `crypto` لتشفير كلمات المرور باستخدام خوارزمية التشفير المتوافقة مع معايير الأمان (PBKDF2 / SHA-256) لمنع الحاجة لتثبيت حزم خارجية جديدة والحفاظ على خفة وزن المشروع.

## 3. مسار تسجيل الدخول (Login Endpoint)
تحديث [src/app/api/auth/login/route.ts](file:///C:/Users/20101/saas-clinic-ai/src/app/api/auth/login/route.ts) ليقبل:
- `email`
- `password`

وسيقوم بالتحقق من وجود المستخدم ومطابقة الهاش الخاص بكلمة المرور، وتوليد JWT Token يحمل:
- `userId`
- `clinicId` (tenantId)
- `role`

## 4. تحديث معالج تهيئة العيادات (Onboarding Wizard)
تعديل [src/scripts/onboard-tenant.ts](file:///C:/Users/20101/saas-clinic-ai/src/scripts/onboard-tenant.ts) ليقوم بطلب إدخال البريد الإلكتروني وكلمة المرور للمدير عند إنشاء أي عيادة جديدة، ويقوم بتشفيرها وحفظها في جدول الـ `User` الجديد.

## 5. خطة التحقق والـ Verification
- تشغيل `npx prisma db push` لتحديث قاعدة البيانات.
- تشغيل اختبارات TypeScript للتأكد من عدم وجود أخطاء في الـ imports أو الـ compilation.
- إجراء اختبار تسجيل دخول يدوي باستخدام بريد إلكتروني وكلمة مرور صحيحة، وآخر بكلمة مرور خاطئة للتأكد من الحماية.
