import "dotenv/config";
import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/db";
import { JobStatus } from "@/generated/prisma";
import { IncomingMessagePayload } from "@/lib/domain/interfaces/IJobDispatcher";
import { ConversationEngine } from "@/lib/domain/ConversationEngine";
import { ClinicWithCatalog } from "@/lib/domain/types";

const redisUrl = process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";

console.log("Starting BullMQ Worker for WhatsApp Incoming Messages...");

const worker = new Worker(
  "whatsapp-incoming",
  async (job: Job<IncomingMessagePayload>) => {
    const { wamid, clinicId, clientPhone, messageText, source } = job.data;

    console.log(`[Worker] Processing Job ${job.id} (wamid: ${wamid})`);

    // 1. Update Job State in Prisma
    await prisma.jobTracker.update({
      where: { jobId: job.id! },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
        attempts: job.attemptsMade + 1,
      },
    });

    try {
      // 2. Fetch Clinic context
      const clinic = await prisma.clinic.findFirst({
        where: { whatsappPhoneId: clinicId },
        include: {
          branches: { where: { status: "ACTIVE" } },
          doctors: { 
            where: { status: "ACTIVE" },
            include: { services: { include: { service: true } } }
          },
          services: { where: { status: "ACTIVE" } },
        },
      });

      if (!clinic) {
        throw new Error(`Clinic not found: ${clinicId}`);
      }

      if (!clinic.isAiActive) {
        console.log(`[Worker] AI is disabled for clinic ${clinicId}, skipping.`);
        return { success: true, skipped: true };
      }

      // 3. Process via ConversationEngine
      const finalResponse = await ConversationEngine.processMessage(
        clinic as unknown as ClinicWithCatalog,
        clientPhone,
        messageText,
        source
      );

      // 4. Decrypt Token and Reply to Meta
      // (For this step, we should Ideally call a Meta API service, but for now we'll duplicate the logic or we can move it to a MetaGraphClient)
      const storedToken = clinic.whatsappToken;
      if (storedToken) {
        const { decrypt } = await import("@/lib/encryption");
        const parts = storedToken.split(":");
        if (parts.length === 3) {
          const [iv, authTag, encryptedData] = parts;
          const decryptedToken = decrypt(encryptedData, iv, authTag);

          const metaResponse = await fetch(
            `https://graph.facebook.com/v18.0/${clinic.whatsappPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${decryptedToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: clientPhone,
                type: "text",
                text: {
                  preview_url: false,
                  body: finalResponse.response,
                },
              }),
            }
          );

          if (!metaResponse.ok) {
            throw new Error(`Meta API error: ${await metaResponse.text()}`);
          }
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      throw error; // Let BullMQ catch it for retry
    }
  },
  {
    connection: {
      url: redisUrl,
    },
    concurrency: 5, // Process up to 5 messages concurrently
  }
);

worker.on("completed", async (job) => {
  console.log(`[Worker] Job ${job.id} COMPLETED.`);
  try {
    await prisma.jobTracker.update({
      where: { jobId: job.id! },
      data: {
        status: JobStatus.COMPLETED,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Failed to update jobTracker state on complete", err);
  }
});

worker.on("failed", async (job, err) => {
  console.log(`[Worker] Job ${job?.id} FAILED: ${err.message}`);
  if (job) {
    try {
      await prisma.jobTracker.update({
        where: { jobId: job.id! },
        data: {
          status: JobStatus.FAILED,
          error: err.message,
          finishedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error("Failed to update jobTracker state on fail", dbErr);
    }
  }
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker gracefully...");
  await worker.close();
  process.exit(0);
});
