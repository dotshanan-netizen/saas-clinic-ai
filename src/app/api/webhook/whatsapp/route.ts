import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { processChatMessage } from "@/lib/chat-processor";

// GET: Meta Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      // 1. Check if token matches global verify token
      const globalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "RIVAL_CLINIC_VERIFY_TOKEN";
      if (token === globalVerifyToken) {
        console.log("Meta webhook verified successfully using global token.");
        return new Response(challenge, { status: 200 });
      }

      // 2. Otherwise search the database for any clinic configured with this verify token
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
    const payload = await request.json();
    console.log("Received WhatsApp Webhook Payload:", JSON.stringify(payload, null, 2));

    // Meta webhooks have a nested structure
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    // We only process message events, ignore statuses (sent, delivered, read receipts)
    if (value && value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from; // Customer phone number, e.g. "966551234567"
      const messageText = message.text?.body;
      const messageType = message.type;
      const phoneNumberId = value.metadata?.phone_number_id; // Phone number ID that received the message

      if (!messageText || messageType !== "text") {
        console.log(`Ignoring non-text message type: ${messageType}`);
        return new Response("Success: Non-text message ignored", { status: 200 });
      }

      // Ensure phone number starts with a '+' for database consistency
      const clientPhone = from.startsWith("+") ? from : `+${from}`;

      // 1. Fetch the clinic configured with this phone number ID
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

      console.log(`Processing WhatsApp message from ${clientPhone} for clinic ${clinic.name}...`);

      // 2. Process message using the shared chatbot engine
      const result = await processChatMessage(clinic, clientPhone, messageText, "WhatsApp");
      console.log(`Generated response text: "${result.response}"`);

      // 3. Decrypt the WhatsApp access token and send response back via Meta Graph API
      const storedToken = clinic.whatsappToken;
      if (storedToken) {
        try {
          const parts = storedToken.split(":");
          if (parts.length === 3) {
            const [iv, authTag, encryptedData] = parts;
            const decryptedToken = decrypt(encryptedData, iv, authTag);

            console.log(`Sending response back to ${from} via Meta Graph API...`);
            const metaResponse = await fetch(
              `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${decryptedToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: from,
                  type: "text",
                  text: {
                    preview_url: false,
                    body: result.response,
                  },
                }),
              }
            );

            if (!metaResponse.ok) {
              const errText = await metaResponse.text();
              console.error(`Meta API error response: ${metaResponse.status} - ${errText}`);
            } else {
              console.log(`Successfully dispatched WhatsApp message response via Meta API.`);
            }
          } else {
            console.error("Stored whatsappToken format is invalid (requires iv:authTag:encryptedData).");
          }
        } catch (err) {
          console.error("Failed to decrypt token or call Meta Graph API:", err);
        }
      } else {
        console.warn(`No whatsappToken configured/stored for clinic: ${clinic.name}. Cannot reply.`);
      }

      return new Response("Success: Message processed and response dispatched", { status: 200 });
    }

    return new Response("Success: Event ignored (no messages found)", { status: 200 });
  } catch (error) {
    console.error("Error handling WhatsApp Webhook POST:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
