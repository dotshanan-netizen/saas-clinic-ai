import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seeding...");

  // Clear existing data to avoid duplication on re-run
  await prisma.booking.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.doctorBranch.deleteMany({});
  await prisma.doctorService.deleteMany({});
  await prisma.workingHour.deleteMany({});
  await prisma.knowledgeBase.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.clinic.deleteMany({});

  console.log("Database cleared.");

  // Create Clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: "عيادة ريفال للتجميل",
      slug: "rival-clinic",
      countryCode: "SA",
      allowedCountries: "SA",
      customPrompt: `أنتِ سارة، موظفة استقبال سعودية لبقة ومحترفة في "عيادة ريفال للتجميل".
هدفِك هو تحويل الاستفسارات إلى حجوزات مؤكدة بجمع البيانات الخمسة بالتسلسل.
نبرة صوتك: اللهجة البيضاء السعودية اللبقة والمحترمة (تستخدمين: حياك الله، يا هلا ومسهلا بكِ، يا قلبي، تسعدنا خدمتكِ).
تخاطبين العميل بصيغة المؤنث افتراضياً.

قواعد مهمة:
1. ممنوع الاستشارات الطبية أو التشخيص. اعتذري بلطف وقولي: "بخصوص استفسارك الطبي الدقيق، هذا يقدر يفيدك فيه الطبيب المختص بعد الكشف بالعيادة عشان يشخصك صح ويعطيك الخطة المناسبة. حابة نحجز لك كشفية؟"
2. اجمعي البيانات الخمسة التالية واحداً تلو الآخر بالتسلسل:
   - الاسم الثلاثي ورقم الجوال
   - الخدمة المطلوبة
   - الطبيب المفضل (أو اقتراح المتاح)
   - الفرع المفضل (الصحافة أم التحلية)
   - الوقت المفضل (صباحي أم مسائي، وفي أي يوم)
3. عند اكتمال البيانات، اعرضي تذكرة الحجز المبدئي وقولي أن موظف الاستقبال سيتواصل لتأكيد الحجز النهائي خلال دقائق.`
    }
  });

  console.log(`Clinic created: ${clinic.name} (${clinic.id})`);

  // Create Admin User for the clinic
  const { hashPassword } = await import("../src/lib/auth.js");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@rival.com",
      passwordHash: hashPassword("clinova-admin-2026"),
      name: "سارة المشرفة",
      role: "ADMIN",
      clinicId: clinic.id
    }
  });

  console.log(`Admin user created: ${adminUser.email}`);

  // Create Branches
  const branchSahafa = await prisma.branch.create({
    data: {
      name: "فرع الصحافة",
      city: "الرياض",
      address: "طريق الملك فهد، حي الصحافة، الرياض",
      clinicId: clinic.id
    }
  });

  const branchTahliya = await prisma.branch.create({
    data: {
      name: "فرع التحلية",
      city: "الرياض",
      address: "شارع التحلية (الأمير محمد بن عبد العزيز)، الرياض",
      clinicId: clinic.id
    }
  });

  console.log(`Created branches: ${branchSahafa.name}, ${branchTahliya.name}`);

  // Create Working Hours for both branches
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  for (const b of [branchSahafa, branchTahliya]) {
    for (const d of days) {
      await prisma.workingHour.create({
        data: {
          branchId: b.id,
          dayOfWeek: d,
          startTime: "09:00",
          endTime: "21:00",
          isClosed: d === "FRIDAY" // Friday is closed
        }
      });
    }
  }
  console.log("Created working hours for branches.");

  // Create Doctors
  const docSahar = await prisma.doctor.create({
    data: {
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      clinicId: clinic.id
    }
  });

  const docAhmed = await prisma.doctor.create({
    data: {
      name: "د. أحمد",
      specialty: "جراحة تجميلية",
      clinicId: clinic.id
    }
  });

  const docNoura = await prisma.doctor.create({
    data: {
      name: "الأخصائية نورة",
      specialty: "ليزر وعناية بالبشرة",
      clinicId: clinic.id
    }
  });

  console.log("Created doctors.");

  // Create Services
  const botox = await prisma.service.create({
    data: {
      name: "بوتكس كامل للوجه",
      price: 500,
      description: "إزالة تجاعيد الجبهة وحول العينين باستخدام البوتكس الأصلي الأمريكي.",
      clinicId: clinic.id
    }
  });

  const filler = await prisma.service.create({
    data: {
      name: "فيلر الشفايف",
      price: 1200,
      description: "توريد وتعبئة الشفايف بالفيلر السويسري المناسب لنضارة طبيعية.",
      clinicId: clinic.id
    }
  });

  const laser = await prisma.service.create({
    data: {
      name: "ليزر إزالة الشعر جسم كامل",
      price: 450,
      description: "جلسة ليزر جسم كامل مع الرتوش باستخدام جهاز جنتل برو الحديث.",
      clinicId: clinic.id
    }
  });

  const hydra = await prisma.service.create({
    data: {
      name: "تنظيف البشرة العميق",
      price: 350,
      description: "تنظيف هيدرافيشل عميق للبشرة لإزالة الرؤوس السوداء وإعادة النضارة.",
      clinicId: clinic.id
    }
  });

  const consultation = await prisma.service.create({
    data: {
      name: "كشفية جلدية وتجميل",
      price: 150,
      description: "كشفية مع طبيب الجلدية لتحديد المشاكل ووضع خطة العلاج المناسبة.",
      clinicId: clinic.id
    }
  });

  console.log("Created services.");

  // Link Doctors to Branches (DoctorBranch)
  // د. سحر تعمل في الفرعين
  await prisma.doctorBranch.createMany({
    data: [
      { doctorId: docSahar.id, branchId: branchSahafa.id },
      { doctorId: docSahar.id, branchId: branchTahliya.id }
    ]
  });

  // د. أحمد يعمل في التحلية فقط
  await prisma.doctorBranch.create({
    data: { doctorId: docAhmed.id, branchId: branchTahliya.id }
  });

  // الأخصائية نورة تعمل في الصحافة فقط
  await prisma.doctorBranch.create({
    data: { doctorId: docNoura.id, branchId: branchSahafa.id }
  });

  console.log("Linked doctors to branches.");

  // Link Doctors to Services (DoctorService)
  // د. سحر تقدم البوتكس، الفيلر، والكشفية
  await prisma.doctorService.createMany({
    data: [
      { doctorId: docSahar.id, serviceId: botox.id },
      { doctorId: docSahar.id, serviceId: filler.id },
      { doctorId: docSahar.id, serviceId: consultation.id }
    ]
  });

  // د. أحمد يقدم الكشفية فقط في الجراحة التجميلية
  await prisma.doctorService.create({
    data: { doctorId: docAhmed.id, serviceId: consultation.id }
  });

  // الأخصائية نورة تقدم الليزر وتنظيف البشرة العميق
  await prisma.doctorService.createMany({
    data: [
      { doctorId: docNoura.id, serviceId: laser.id },
      { doctorId: docNoura.id, serviceId: hydra.id }
    ]
  });

  console.log("Linked doctors to services.");

  // Create Knowledge Base realistic demo entries
  await prisma.knowledgeBase.createMany({
    data: [
      {
        category: "FAQ",
        content: `س: ما هي أوقات ومواعيد العمل الرسمية بالعيادة؟
ج: تفتح عيادة ريفال للتجميل أبوابها لخدمتكم طيلة أيام الأسبوع من السبت إلى الخميس من الساعة 9:00 صباحاً وحتى الساعة 9:00 مساءً، بينما يعتبر يوم الجمعة إجازة أسبوعية مغلقة لكافة الفروع.`,
        clinicId: clinic.id
      },
      {
        category: "POLICY",
        content: `سياسة تعديل وإلغاء المواعيد بالعيادة:
1. يجب إخطار العيادة بطلب الإلغاء أو إعادة الجدولة قبل 24 ساعة على الأقل من موعد الجلسة المحجوزة.
2. في حال التخلف عن الموعد دون إخطار مسبق، قد يتم فرض رسوم حجز رمزية أو احتساب الجلسة من الباكيج المشترك فيه.`,
        clinicId: clinic.id
      },
      {
        category: "GENERAL_INFO",
        content: `عروض عيادة ريفال الحالية والمميزة:
1. عرض تنظيف البشرة العميق (هيدرافيشيل) بسعر خاص 350 ريال فقط بدلاً من 450 ريال.
2. باكيج ليزر إزالة الشعر للجسم كامل مع الرتوش (بأحدث أجهزة جنتل برو) بقيمة 450 ريال للجلسة الواحدة.
3. حقن البوتكس الكامل للوجه لإزالة التجاعيد وتصفية البشرة بسعر 500 ريال فقط.`,
        clinicId: clinic.id
      }
    ]
  });

  console.log("Created realistic Knowledge Base entries.");
  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
