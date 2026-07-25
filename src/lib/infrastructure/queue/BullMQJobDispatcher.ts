import { Prisma } from "@/generated/prisma";
import { Queue } from "bullmq";
import { IJobDispatcher, IncomingMessagePayload } from "@/lib/domain/interfaces/IJobDispatcher";
import { prisma } from "@/lib/db";
import { JobStatus } from "@/generated/prisma";

export type { IncomingMessagePayload };



import { ConnectionManager } from "../resilience/ConnectionManager";

// Ensure we don't recreate the queue continuously in dev mode
const globalForBull = global as unknown as { whatsappQueue: Queue };
export const whatsappQueue =
  globalForBull.whatsappQueue ||
  new Queue("whatsapp-incoming", {
    connection: ConnectionManager.getRedisConnection("whatsapp-incoming"),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { age: 3600 * 24, count: 500 }, // Keep last 500 completed for 24h
      removeOnFail: { age: 3600 * 24 * 7, count: 1000 }, // Keep last 1000 failed for 7 days
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
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(`Job Enqueued: ${job.id} for Clinic: ${payload.clinicId}`);
  }
}

export const jobDispatcher = new BullMQJobDispatcher();
