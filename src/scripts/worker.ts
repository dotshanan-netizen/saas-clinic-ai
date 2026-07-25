import "dotenv/config";
import { documentWorker } from "../lib/infrastructure/queue/DocumentProcessorQueue";
import { incomingMessageWorker } from "../lib/infrastructure/queue/IncomingMessageWorker";

console.log("🚀 Starting background workers...");

documentWorker.on("ready", () => {
  console.log("✅ DocumentProcessor Worker is ready and listening to 'document-processing' queue");
});

documentWorker.on("error", (err) => {
  console.error("❌ DocumentProcessor Worker error:", err);
});

incomingMessageWorker.on("ready", () => {
  console.log("✅ IncomingMessageWorker is ready and listening to 'whatsapp-incoming' queue");
});

incomingMessageWorker.on("error", (err) => {
  console.error("❌ IncomingMessageWorker error:", err);
});

// Handle graceful shutdown
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Closing workers gracefully...`);
  try {
    await Promise.all([
      documentWorker.close(),
      incomingMessageWorker.close()
    ]);
    console.log("Workers closed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
