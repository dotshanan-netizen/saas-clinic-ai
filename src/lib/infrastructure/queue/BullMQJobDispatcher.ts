import { Queue } from "bullmq";
import { IJobDispatcher, IncomingMessagePayload } from "@/lib/domain/interfaces/IJobDispatcher";
import { prisma } from "@/lib/db";
import { JobStatus } from "@/generated/prisma";

const redisUrl = process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";

// Ensure we don't recreate the queue continuously in dev mode
const globalForBull = global as unknown as { whatsappQueue: Queue };
export const whatsappQueue =
  globalForBull.whatsappQueue ||
  new Queue("whatsapp-incoming", {
    connection: {
      url: redisUrl,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

if (process.env.NODE_ENV !== "production") globalForBull.whatsappQueue = whatsappQueue;

export class BullMQJobDispatcher implements IJobDispatcher {
  async enqueueIncomingMessage(payload: IncomingMessagePayload): Promise<void> {
    // We add deduplication by passing the wamid as jobId. 
    // This adds another layer of idempotency inside BullMQ.
    const job = await whatsappQueue.add("process-message", payload, {
      jobId: payload.wamid, 
    });

    // We track the job state in our Database for future UI dashboard
    await prisma.jobTracker.create({
      data: {
        jobId: job.id!,
        type: "incoming-message",
        status: JobStatus.PENDING,
        payload: payload as any,
      },
    });

    console.log(`Job Enqueued: ${job.id} for Clinic: ${payload.clinicId}`);
  }
}

export const jobDispatcher = new BullMQJobDispatcher();
