import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import readline from "readline";
import { hashPassword } from "@/lib/auth";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("=== CLINIC TENANT ONBOARDING WIZARD ===");
  
  const name = await question("Enter Clinic Name (e.g. عيادة التميز): ");
  if (!name.trim()) throw new Error("Clinic name is required");

  const slug = await question("Enter Clinic Slug (e.g. excellence-clinic): ");
  if (!slug.trim()) throw new Error("Clinic slug is required");

  const email = await question("Enter Admin Email (e.g. admin@excellence.com): ");
  if (!email.trim()) throw new Error("Admin email is required");

  const password = await question("Enter Admin Password: ");
  if (!password.trim()) throw new Error("Admin password is required");

  // Validate slug uniqueness
  const existing = await prisma.clinic.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Slug '${slug}' is already in use by clinic: ${existing.name}`);
  }

  // Validate email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error(`Email '${email}' is already registered`);
  }

  const phoneId = await question("Enter WhatsApp Phone ID (optional): ");
  const verifyToken = await question("Enter WhatsApp Verify Token (optional): ");
  const wabaId = await question("Enter WhatsApp Business Account ID (WABA ID) (optional): ");
  const customPrompt = await question("Enter Custom AI System Prompt (optional, press enter for default): ");

  console.log("\nCreating clinic in database...");

  const clinic = await prisma.clinic.create({
    data: {
      name: name.trim(),
      slug: slug.trim(),
      whatsappPhoneId: phoneId.trim() || null,
      whatsappVerifyToken: verifyToken.trim() || null,
      whatsappWabaId: wabaId.trim() || null,
      customPrompt: customPrompt.trim() || `أنت موظف استقبال لبق ومحترف في عيادة ${name.trim()}. هدفك حجز مواعيد للعملاء بجمع أسمائهم، خدماتهم، فرعهم، والوقت المفضل.`,
      countryCode: "SA",
      allowedCountries: "SA",
    },
  });

  console.log(`\n🎉 Success! Clinic created with ID: ${clinic.id}`);
  console.log(`Slug: ${clinic.slug}`);
  console.log(`Name: ${clinic.name}`);

  console.log("\nCreating admin user...");
  const user = await prisma.user.create({
    data: {
      email: email.trim(),
      passwordHash: hashPassword(password.trim()),
      name: "Admin User",
      role: "ADMIN",
      clinicId: clinic.id,
    },
  });
  console.log(`Admin user created: ${user.email}`);

  // Auto-create a default branch
  console.log("\nCreating default branch...");
  const branch = await prisma.branch.create({
    data: {
      name: "الفرع الرئيسي",
      city: "الرياض",
      address: "العنوان الرئيسي للعيادة",
      clinicId: clinic.id,
    },
  });
  console.log(`Default branch created: ${branch.name}`);

  // Auto-create default working hours (9am - 9pm, Sat-Thu, Fri closed)
  console.log("\nCreating default working hours...");
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY", "SUNDAY"];
  for (const day of days) {
    await prisma.workingHour.create({
      data: {
        branchId: branch.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "21:00",
        isClosed: false,
      },
    });
  }
  await prisma.workingHour.create({
    data: {
      branchId: branch.id,
      dayOfWeek: "FRIDAY",
      startTime: "09:00",
      endTime: "21:00",
      isClosed: true,
    },
  });
  console.log("Working hours created successfully!");
  console.log("\n=== ONBOARDING COMPLETE ===");
}

main()
  .catch((err) => {
    console.error("\n❌ Onboarding failed:", err.message);
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
