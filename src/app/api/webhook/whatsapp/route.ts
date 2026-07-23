import { prisma } from "@/lib/db";
import crypto from "crypto";
import { jobDispatcher } from "@/lib/infrastructure/queue/BullMQJobDispatcher";

// GET: Meta Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log({
      event: "WHATSAPP_WEBHOOK_VERIFY",
      timestamp: new Date().toISOString(),
      mode,
      token,
      challenge
    });

    if (mode === "subscribe" && token) {
      const globalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "RIVAL_CLINIC_VERIFY_TOKEN";
      if (token === globalVerifyToken) {
        console.log("Meta webhook verified successfully using global token.");
        return new Response(challenge, { status: 200 });
      }

      const clinic = await prisma.clinic.findFirst({
        where: { whatsappVerifyToken: token },
      });

      if (clinic) {
        console.log(`Meta webhook verified successfully for clinic: ${clinic.name}`);
        return new Response(challenge, { status: 200 });
      }

      console.warn(`Meta webhook verification failed: invalid token "${token}"`);
      return new Response("Forbidden: Invalid verification token", { status: 403 });
    }

    return new Response("Bad Request", { status: 400 });
  } catch (error) {
    console.error("Error in webhook GET verification:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// POST: Receiving incoming WhatsApp message notifications from Meta
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const secret = process.env.WHATSAPP_APP_SECRET;

    console.log({
      event: "WHATSAPP_WEBHOOK_RECEIVED",
      timestamp: new Date().toISOString(),
      hasSignature: !!signature,
      rawBodySnippet: rawBody.slice(0, 500)
    });

    if (secret && signature) {
      const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const expectedSignature = `sha256=${hmac}`;
      if (signature !== expectedSignature) {
        console.error("Invalid webhook signature");
        return new Response("Unauthorized", { status: 401 });
      }
    } else if (secret && !signature) {
      console.warn("Missing X-Hub-Signature-256 header in production");
      return new Response("Unauthorized", { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return new Response("Bad Request", { status: 400 });
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value && value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from;
      const messageText = message.text?.body || "";
      const messageType = message.type;
      const phoneNumberId = value.metadata?.phone_number_id;
      const wamid = message.id;

      console.log({
        event: "WHATSAPP_MESSAGE_PARSED",
        timestamp: new Date().toISOString(),
        phoneNumberId,
        wamid,
        from,
        messageType
      });

      // Idempotency check
      try {
        await prisma.processedWebhook.create({
          data: { id: wamid, clinicId: phoneNumberId },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          console.log(`[Idempotency] Duplicate webhook ignored for wamid: ${wamid}`);
          return new Response("Success: Duplicate event ignored", { status: 200 });
        }
        throw err;
      }

      const clientPhone = from.startsWith("+") ? from : `+${from}`;

      if (process.env.USE_QUEUE === "true") {
        console.log({
          event: "QUEUE_JOB_CREATING",
          timestamp: new Date().toISOString(),
          clinicId: phoneNumberId,
          wamid,
          clientPhone
        });

        // Offload processing to BullMQ worker!
        await jobDispatcher.enqueueIncomingMessage({
          wamid,
          clinicId: phoneNumberId, // this is the whatsappPhoneId
          clientPhone,
          messageText,
          source: "WhatsApp",
          messageType
        });

        console.log({
          event: "QUEUE_JOB_CREATED",
          timestamp: new Date().toISOString(),
          clinicId: phoneNumberId,
          jobId: "enqueued",
          wamid
        });

        console.log(`[Webhook] Enqueued message (${messageType}) from ${clientPhone} to BullMQ.`);
      } else {
        console.log({
          event: "SYNC_PROCESSING_STARTED",
          timestamp: new Date().toISOString(),
          clinicId: phoneNumberId,
          wamid,
          clientPhone
        });

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
          console.error(`Clinic not found: ${phoneNumberId}`);
          return new Response("Clinic not found", { status: 404 });
        }

        // Check for non-text message type
        if (messageType && messageType !== "text") {
          console.warn(`[Webhook] Received non-text message type '${messageType}' from ${clientPhone}. Replying with polite error.`);
          const storedToken = clinic.whatsappToken;
          if (storedToken) {
            const { decrypt } = await import("@/lib/encryption");
            const parts = storedToken.split(":");
            if (parts.length === 3) {
              const [iv, authTag, encryptedData] = parts;
              const decryptedToken = decrypt(encryptedData, iv, authTag);
              const politeResponse = "عذراً، لا أستطيع معالجة الصور، الصوتيات أو الملفات حالياً. يرجى كتابة طلبك كرسالة نصية وسأقوم بمساعدتك فوراً! 🌸";
              await fetch(
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
                    text: { preview_url: false, body: politeResponse },
                  }),
                }
              );
            }
          }
          return new Response("Success: Polite error sent for unsupported media", { status: 200 });
        }

        if (!clinic.isAiActive) {
          console.log(`[Webhook] AI is disabled for clinic ${phoneNumberId}, skipping.`);
          return new Response("Success: AI Disabled", { status: 200 });
        }

        // 2. Process via ConversationEngine
        const { ConversationEngine } = await import("@/lib/domain/ConversationEngine");
        const finalResponse = await ConversationEngine.processMessage(
          clinic as any,
          clientPhone,
          messageText,
          "WhatsApp",
          wamid
        );

        // 3. Decrypt Token and Reply to Meta
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
              console.error(`Meta API error: ${await metaResponse.text()}`);
            } else {
              console.log(`[Webhook] Successfully replied to ${clientPhone} via Meta API.`);
            }
          }
        }
      }

      return new Response("Success: Message processed", { status: 200 });
    }

    return new Response("Success: Event ignored (no messages found)", { status: 200 });
  } catch (error) {
    console.error("Error handling WhatsApp Webhook POST:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

