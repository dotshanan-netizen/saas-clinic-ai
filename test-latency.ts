import { AIProvider } from "./src/lib/infrastructure/ai/AIProvider";
import { prisma } from "./src/lib/db";

async function test() {
  const start = Date.now();
  console.log("Fetching clinic...");
  const clinic = await prisma.clinic.findUnique({ where: { slug: "rival-clinic" }, include: { branches: true, services: true, doctors: { include: { services: { include: { service: true } } } } } });
  
  console.log("Calling OpenAI...");
  try {
    const res = await AIProvider.classifyIntentAndExtractData(
      clinic as any,
      [{ role: "user", content: "??", timestamp: new Date().toISOString() }],
      "WhatsApp",
      {},
      "",
      ""
    );
    console.log("Done in", Date.now() - start, "ms");
    console.log(res);
  } catch(e) {
    console.error("Failed in", Date.now() - start, "ms", e);
  }
}
test().finally(() => prisma.$disconnect());
