import "dotenv/config";
import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/db";
import { JobStatus } from "@/generated/prisma";
import { IncomingMessagePayload } from "@/lib/domain/interfaces/IJobDispatcher";
import { ConversationEngine } from "@/lib/domain/ConversationEngine";
import { ClinicWithCatalog } from "@/lib/domain/types";
import { Redis } from "ioredis";

const redisUrl = process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

console.log("Starting BullMQ Worker for WhatsApp Incoming Messages...");

const worker = new Worker(
  "whatsapp-incoming",
  async (job: Job<IncomingMessagePayload>) => {
    const { wamid, clinicId, clientPhone, messageText, source, messageType } = job.data;

    console.log({
      event: "WORKER_STARTED",
      jobId: job.id,
      wamid,
      clinicId,
      timestamp: new Date().toISOString()
    });

    console.log(`[Worker] Processing Job ${job.id} (wamid: ${wamid})`);

    // 0. Acquire Distributed Lock (Serialize processing per patient to prevent Race Conditions)
    const lockKey = `lock:whatsapp:${clinicId}:${clientPhone}`;
    const lockAcquired = await redis.set(lockKey, "locked", "PX", 10000, "NX");
    
    if (!lockAcquired) {
      console.log(`[Worker] Lock active for ${clientPhone}. Postponing job for retry...`);
      throw new Error("LOCKED_BY_ANOTHER_PROCESS");
    }

    try {
      // 1. Update Job State in Prisma
      await prisma.jobTracker.update({
        where: { jobId: job.id! },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: job.attemptsMade + 1,
        },
      });

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

      // Check for non-text message type (Image, Audio, Video, Document, Sticker, Contact, Location)
      if (messageType && messageType !== "text") {
        console.warn(`[Worker] Received non-text message type '${messageType}' from ${clientPhone}. Replying with polite error.`);
        
        const storedToken = clinic.whatsappToken;
        if (storedToken) {
          const { decrypt } = await import("@/lib/encryption");
          const parts = storedToken.split(":");
          if (parts.length === 3) {
            const [iv, authTag, encryptedData] = parts;
            const decryptedToken = decrypt(encryptedData, iv, authTag);

            const politeResponse = "عذراً، لا أستطيع معالجة الصور، الصوتيات أو الملفات حالياً. يرجى كتابة طلبك كرسالة نصية وسأقوم بمساعدتك فوراً! 🌸";

            const metaResponse = await fetch(
              `https://graph.facebook.com/v18.0/${clinic.whatsappPhoneId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${decryptedToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: clientPhone,
                  type: "text",
                  text: {
                    preview_url: false,
                    body: politeResponse,
                  },
                }),
              }
            );

            if (!metaResponse.ok) {
              console.error(`[Worker] Failed to send media error reply: ${await metaResponse.text()}`);
            }
          }
        }
        return { success: true, unsupportedType: messageType };
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
    } finally {
      await redis.del(lockKey);
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
  const attemptsMade = job ? job.attemptsMade : 0;
  const maxAttempts = job ? (job.opts.attempts || 3) : 3;
  const isExhausted = attemptsMade >= maxAttempts;

  console.log(`[Worker] Job ${job?.id} FAILED (Attempt ${attemptsMade}/${maxAttempts}): ${err.message}`);
  
  if (job) {
    try {
      await prisma.jobTracker.update({
        where: { jobId: job.id! },
        data: {
          status: isExhausted ? JobStatus.FAILED : JobStatus.PENDING,
          error: `${err.message} (Attempt ${attemptsMade}/${maxAttempts})`,
          finishedAt: isExhausted ? new Date() : null,
        },
      });
    } catch (dbErr) {
      console.error("Failed to update jobTracker state on fail", dbErr);
    }
  }
});

const shutdown = async (signal: string) => {
  console.log(`Shutting down worker gracefully (${signal})...`);
  await worker.close();
  await redis.quit();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
