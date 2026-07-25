import { Worker, Job } from "bullmq";
import { prisma } from "../../db";
import { IncomingMessagePayload } from "./BullMQJobDispatcher";
import { ConversationEngine } from "../../domain/ConversationEngine";
import { ClinicWithCatalog } from "../../domain/types";
import { decrypt } from "../../encryption";

const redisUrl = process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";

export const incomingMessageWorker = new Worker(
  "whatsapp-incoming",
  async (job: Job<IncomingMessagePayload>) => {
    console.log(`[IncomingMessageWorker] Processing job ${job.id} for wamid: ${job.data.wamid}`);
    const { wamid, clinicId: phoneNumberId, clientPhone, messageText, source } = job.data;

    // 1. Fetch Clinic context
    const clinic = await prisma.clinic.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
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
      console.error(`[IncomingMessageWorker] Clinic not found: ${phoneNumberId}`);
      throw new Error("Clinic not found");
    }

    if (!clinic.isAiActive) {
      console.log(`[IncomingMessageWorker] AI is disabled for clinic ${phoneNumberId}, skipping.`);
      return;
    }

    // 2. Process via ConversationEngine
    const finalResponse = await ConversationEngine.processMessage(
      clinic as unknown as ClinicWithCatalog,
      clientPhone,
      messageText,
      source,
      wamid
    );

    // 3. Decrypt Token and Reply to Meta
    const storedToken = clinic.whatsappToken;
    if (storedToken) {
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
          console.error(`[IncomingMessageWorker] Meta API error: ${await metaResponse.text()}`);
          throw new Error("Failed to send message to Meta");
        } else {
          console.log(`[IncomingMessageWorker] Successfully replied to ${clientPhone} via Meta API.`);
        }
      }
    }
  },
  {
    connection: { url: redisUrl },
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "5", 10),
    lockDuration: 90000,
  }
);
