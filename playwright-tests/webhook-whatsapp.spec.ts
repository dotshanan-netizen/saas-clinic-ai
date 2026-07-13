import { test, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma";
import { encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

test.describe("Meta WhatsApp Webhook API Tests", () => {
  const clinicSlug = "rival-clinic";
  let testPhone: string;
  let clinicId: string;
  let originalPhoneId: string | null;
  let originalToken: string | null;
  let originalVerifyToken: string | null;

  test.beforeAll(async () => {
    // 1. Fetch clinic
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug }
    });
    if (!clinic) throw new Error("Clinic not found for testing");
    clinicId = clinic.id;
    originalPhoneId = clinic.whatsappPhoneId;
    originalToken = clinic.whatsappToken;
    originalVerifyToken = clinic.whatsappVerifyToken;

    // 2. Configure mock Meta credentials for testing
    // Encrypt dummy token
    const dummyTokenHex = encrypt("EAAGb_TEST_TOKEN_XYZ");
    const formattedToken = `${dummyTokenHex.iv}:${dummyTokenHex.authTag}:${dummyTokenHex.encryptedData}`;

    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        whatsappPhoneId: "123456789_TEST_PHONE_ID",
        whatsappToken: formattedToken,
        whatsappVerifyToken: "VERIFY_TOKEN_TEST_999",
        isAiActive: true,
      }
    });
  });

  test.beforeEach(async () => {
    // Generate a unique phone number for each test run to isolate state
    testPhone = "9665" + Math.floor(10000000 + Math.random() * 90000000).toString();
  });

  test.afterEach(async () => {
    // Clean up created conversations and bookings for the test number
    const formattedPhone = testPhone.startsWith("+") ? testPhone : `+${testPhone}`;
    await prisma.booking.deleteMany({
      where: { clientPhone: formattedPhone.replace(/[\s-]/g, "") }
    });
    await prisma.conversation.deleteMany({
      where: { clientPhone: formattedPhone }
    });
  });

  test.afterAll(async () => {
    // Restore original credentials in the database
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        whatsappPhoneId: originalPhoneId,
        whatsappToken: originalToken,
        whatsappVerifyToken: originalVerifyToken,
      }
    });
    await prisma.$disconnect();
  });

  // GET Verification Tests
  test("should verify GET webhook subscription with matching verify token", async ({ request }) => {
    const response = await request.get("/api/webhook/whatsapp", {
      params: {
        "hub.mode": "subscribe",
        "hub.verify_token": "VERIFY_TOKEN_TEST_999",
        "hub.challenge": "CHALLENGE_ACCEPTED_XYZ"
      }
    });

    expect(response.status()).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toBe("CHALLENGE_ACCEPTED_XYZ");
  });

  test("should verify GET webhook subscription with global verify token", async ({ request }) => {
    const globalToken = process.env.WHATSAPP_VERIFY_TOKEN || "RIVAL_CLINIC_VERIFY_TOKEN";
    const response = await request.get("/api/webhook/whatsapp", {
      params: {
        "hub.mode": "subscribe",
        "hub.verify_token": globalToken,
        "hub.challenge": "GLOBAL_CHALLENGE_OK"
      }
    });

    expect(response.status()).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toBe("GLOBAL_CHALLENGE_OK");
  });

  test("should reject GET webhook subscription with invalid verify token", async ({ request }) => {
    const response = await request.get("/api/webhook/whatsapp", {
      params: {
        "hub.mode": "subscribe",
        "hub.verify_token": "WRONG_TOKEN_INC",
        "hub.challenge": "SOME_CHALLENGE"
      }
    });

    expect(response.status()).toBe(403);
  });

  // POST Message Handling Tests
  test("should receive incoming message, create conversation in DB, and log messages", async ({ request }) => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "966555555555",
                  phone_number_id: "123456789_TEST_PHONE_ID"
                },
                contacts: [
                  {
                    profile: { name: "Test User" },
                    wa_id: testPhone
                  }
                ],
                messages: [
                  {
                    from: testPhone,
                    id: "ABEG12345678_TEST_MSG_ID",
                    timestamp: "1672531199",
                    type: "text",
                    text: { body: "السلام عليكم، حابة أحجز موعد" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const response = await request.post("/api/webhook/whatsapp", { data: payload });
    expect(response.status()).toBe(200);

    // Verify DB entry was created
    const formattedPhone = `+${testPhone}`;
    const conversation = await prisma.conversation.findUnique({
      where: {
        clinicId_clientPhone: {
          clinicId: clinicId,
          clientPhone: formattedPhone
        }
      }
    });

    expect(conversation).not.toBeNull();
    const messages = conversation!.messages as any[];
    expect(messages.length).toBe(2); // 1 User + 1 Assistant
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("السلام عليكم، حابة أحجز موعد");
    expect(messages[1].role).toBe("assistant");
  });
});
