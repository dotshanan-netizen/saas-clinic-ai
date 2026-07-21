import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ConversationEngine } from "@/lib/domain/ConversationEngine";

// GET: Meta Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

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
    console.log("🔥 WhatsApp POST reached");
    const payload = await request.json();
    console.log("Received WhatsApp Webhook Payload:", JSON.stringify(payload, null, 2));

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value && value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from;
      const messageText = message.text?.body;
      const messageType = message.type;
      const phoneNumberId = value.metadata?.phone_number_id;
      const wamid = message.id;

      if (!messageText || messageType !== "text") {
        console.log(`Ignoring non-text message type: ${messageType}`);
        return new Response("Success: Non-text message ignored", { status: 200 });
      }

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

      // Find clinic by Meta phone number ID
      const clinic = await prisma.clinic.findFirst({
        where: { whatsappPhoneId: phoneNumberId },
        include: {
          branches: { where: { status: "ACTIVE" } },
          doctors: { where: { status: "ACTIVE" } },
          services: { where: { status: "ACTIVE" } },
        },
      });

      if (!clinic) {
        console.warn(`No clinic found matching whatsappPhoneId: ${phoneNumberId}`);
        return new Response("Success: Phone number ID not recognized", { status: 200 });
      }

      if (!clinic.isAiActive) {
        console.log(`AI chat is disabled for clinic: ${clinic.name}`);
        return new Response("Success: AI chat disabled", { status: 200 });
      }

      console.log(`Processing message from ${clientPhone} for clinic ${clinic.name}...`);

      // Process via ConversationEngine directly (no queue needed)
      const result = await ConversationEngine.processMessage(clinic, clientPhone, messageText, "WhatsApp");
      console.log(`Generated response: "${result.response}"`);

      // Send reply back via Meta Graph API
      const storedToken = clinic.whatsappToken;
      if (storedToken) {
        try {
          const parts = storedToken.split(":");
          if (parts.length === 3) {
            const [iv, authTag, encryptedData] = parts;
            const decryptedToken = decrypt(encryptedData, iv, authTag);

            const metaResponse = await fetch(
              `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${decryptedToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: from,
                  type: "text",
                  text: { preview_url: false, body: result.response },
                }),
              }
            );

            if (!metaResponse.ok) {
              const errText = await metaResponse.text();
              console.error(`Meta API error: ${metaResponse.status} - ${errText}`);
            } else {
              console.log(`✅ Reply sent successfully to ${from}`);
            }
          }
        } catch (err) {
          console.error("Failed to send reply via Meta API:", err);
        }
      } else {
        console.warn(`No whatsappToken configured for clinic: ${clinic.name}`);
      }

      return new Response("Success: Message processed", { status: 200 });
    }

    return new Response("Success: Event ignored (no messages found)", { status: 200 });
  } catch (error) {
    console.error("Error handling WhatsApp Webhook POST:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
