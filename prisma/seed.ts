import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seeding...");

  // Clear existing data to avoid duplication on re-run
  await prisma.booking.deleteMany({});
  await prisma.conversation.deleteMany({});
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

  // Create Branches
  const branches = await Promise.all([
    prisma.branch.create({
      data: {
        name: "فرع الصحافة",
        address: "طريق الملك فهد، حي الصحافة، الرياض",
        clinicId: clinic.id
      }
    }),
    prisma.branch.create({
      data: {
        name: "فرع التحلية",
        address: "شارع التحلية (الأمير محمد بن عبد العزيز)، الرياض",
        clinicId: clinic.id
      }
    })
  ]);

  console.log(`Created ${branches.length} branches.`);

  // Create Doctors
  const doctors = await Promise.all([
    prisma.doctor.create({
      data: {
        name: "د. سحر",
        specialty: "جلدية وتجميل",
        clinicId: clinic.id
      }
    }),
    prisma.doctor.create({
      data: {
        name: "د. أحمد",
        specialty: "جراحة تجميلية",
        clinicId: clinic.id
      }
    }),
    prisma.doctor.create({
      data: {
        name: "الأخصائية نورة",
        specialty: "ليزر وعناية بالبشرة",
        clinicId: clinic.id
      }
    })
  ]);

  console.log(`Created ${doctors.length} doctors.`);

  // Create Services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "بوتكس كامل للوجه",
        price: 500,
        description: "إزالة تجاعيد الجبهة وحول العينين باستخدام البوتكس الأصلي الأمريكي.",
        clinicId: clinic.id
      }
    }),
    prisma.service.create({
      data: {
        name: "فيلر الشفايف",
        price: 1200,
        description: "توريد وتعبئة الشفايف بالفيلر السويسري المناسب لنضارة طبيعية.",
        clinicId: clinic.id
      }
    }),
    prisma.service.create({
      data: {
        name: "ليزر إزالة الشعر جسم كامل",
        price: 450,
        description: "جلسة ليزر جسم كامل مع الرتوش باستخدام جهاز جنتل برو الحديث.",
        clinicId: clinic.id
      }
    }),
    prisma.service.create({
      data: {
        name: "تنظيف البشرة العميق",
        price: 350,
        description: "تنظيف هيدرافيشل عميق للبشرة لإزالة الرؤوس السوداء وإعادة النضارة.",
        clinicId: clinic.id
      }
    }),
    prisma.service.create({
      data: {
        name: "كشفية جلدية وتجميل",
        price: 150,
        description: "كشفية مع طبيب الجلدية لتحديد المشاكل ووضع خطة العلاج المناسبة.",
        clinicId: clinic.id
      }
    })
  ]);

  console.log(`Created ${services.length} services.`);
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
