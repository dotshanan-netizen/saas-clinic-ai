/**
 * Conversations API Contract Tests (Batch A — API Surface Fix)
 *
 * Verifies the response shape of GET and POST /api/conversations handlers.
 * Ensures the frontend (dashboard) receives the expected types:
 *   - ConversationItem[] for list endpoint
 *   - { messages, booking, humanTakeover } for single-conversation endpoint
 *   - { success, message } for send-message endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../singleton";

// Mock the encryption module so the POST handler can decrypt the mock token
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("mock-decrypted-token"),
  encrypt: vi.fn().mockReturnValue("mock-encrypted"),
}));

// Dynamic imports so vi.mock() runs first
const BASE_URL = "http://localhost:3000";

function createRequest(method: string, url: string, body?: unknown): Request {
  const headers = new Headers({ "x-tenant-id": "cmryoendy0000dzrctyxgyf3k" });
  if (body) headers.set("Content-Type", "application/json");
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/conversations — list endpoint", () => {
  beforeEach(() => {
    prismaMock.clinic.findUnique.mockResolvedValue({
      id: "cmryoendy0000dzrctyxgyf3k",
      name: "عيادة ريفال للتجميل",
      countryCode: "SA",
      allowedCountries: "SA",
      createdAt: new Date(),
      updatedAt: new Date(),
      customPrompt: null,
      slug: "rival-clinic",
      timezone: null,
      logoUrl: null,
      wabaId: null,
      whatsappPhoneId: null,
      whatsappToken: null,
      webhookVerifyToken: null,
      aiName: null,
      aiPersonality: null,
      sessionTimeoutMinutes: 30,
      campaignSource: null,
      deletedAt: null,
      bookingPageUrl: null,
    } as any);
  });

  it("returns ConversationItem[] shape when conversations exist", async () => {
    const now = new Date();
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: "conv-1",
        clientPhone: "+966501234567",
        clinicId: "cmryoendy0000dzrctyxgyf3k",
        messages: [
          { role: "user", content: "السلام عليكم", timestamp: now.toISOString() },
          { role: "assistant", content: "وعليكم السلام", timestamp: now.toISOString() },
        ],
        updatedAt: now,
        createdAt: now,
        humanTakeover: false,
        bookingDraft: null,
        clientName: "سارة",
        currentStateName: "IDLE",
      },
    ] as any);

    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: "book-1",
        clientName: "سارة",
        clientPhone: "+966501234567",
        serviceName: "فيلر",
        doctorName: "د. أحمد",
        branchName: "فرع الصحافة",
        timeSlot: "09:00 ص",
        source: "WhatsApp",
        clinicId: "cmryoendy0000dzrctyxgyf3k",
        createdAt: now,
        status: "PENDING",
      },
    ] as any);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(createRequest("GET", `${BASE_URL}/api/conversations`));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);

    const item = data[0];
    // ConversationItem contract
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("clientPhone");
    expect(item).toHaveProperty("clientName");
    expect(item).toHaveProperty("serviceName");
    expect(item).toHaveProperty("status");
    expect(item).toHaveProperty("lastMessage");
    expect(item).toHaveProperty("updatedAt");

    // Type checks
    expect(typeof item.id).toBe("string");
    expect(typeof item.clientPhone).toBe("string");
    expect(item.lastMessage).toBe("وعليكم السلام");
    expect(item.serviceName).toBe("فيلر");
    expect(item.status).toBe("PENDING");
    expect(typeof item.updatedAt).toBe("string");
  });

  it("returns empty array when no conversations exist", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(createRequest("GET", `${BASE_URL}/api/conversations`));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("sets status to 'NEW' when no booking exists", async () => {
    const now = new Date();
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: "conv-2",
        clientPhone: "+966500000000",
        clinicId: "cmryoendy0000dzrctyxgyf3k",
        messages: [],
        updatedAt: now,
        createdAt: now,
        humanTakeover: false,
        bookingDraft: null,
        clientName: null,
        currentStateName: "IDLE",
      },
    ] as any);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(createRequest("GET", `${BASE_URL}/api/conversations`));
    const data = await response.json();

    expect(data[0].status).toBe("NEW");
    expect(data[0].clientName).toBeNull();
    expect(data[0].serviceName).toBeNull();
  });

  it("returns 401 when x-tenant-id is missing", async () => {
    const request = new Request(`${BASE_URL}/api/conversations`, { method: "GET" });

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns lastMessage as null when messages array is empty", async () => {
    const now = new Date();
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: "conv-3",
        clientPhone: "+966500000001",
        clinicId: "cmryoendy0000dzrctyxgyf3k",
        messages: [],
        updatedAt: now,
        createdAt: now,
        humanTakeover: false,
        bookingDraft: null,
        clientName: null,
        currentStateName: "IDLE",
      },
    ] as any);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(createRequest("GET", `${BASE_URL}/api/conversations`));
    const data = await response.json();

    expect(data[0].lastMessage).toBeNull();
  });
});

describe("GET /api/conversations?clientPhone= — single conversation", () => {
  beforeEach(() => {
    prismaMock.clinic.findUnique.mockResolvedValue({
      id: "cmryoendy0000dzrctyxgyf3k",
      name: "عيادة ريفال للتجميل",
      countryCode: "SA",
      allowedCountries: "SA",
      createdAt: new Date(),
      updatedAt: new Date(),
      customPrompt: null,
      slug: "rival-clinic",
      timezone: null,
      logoUrl: null,
      wabaId: null,
      whatsappPhoneId: null,
      whatsappToken: null,
      webhookVerifyToken: null,
      aiName: null,
      aiPersonality: null,
      sessionTimeoutMinutes: 30,
      campaignSource: null,
      deletedAt: null,
      bookingPageUrl: null,
    } as any);
  });

  it("returns { messages, booking, humanTakeover } shape", async () => {
    const now = new Date();
    const ts = now.toISOString();

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conv-1",
      clientPhone: "+966501234567",
      clinicId: "cmryoendy0000dzrctyxgyf3k",
      messages: [
        { role: "user", content: "السلام عليكم", timestamp: ts },
        { role: "assistant", content: "وعليكم السلام", timestamp: ts },
        { role: "system", content: "INTENT_RESET", timestamp: ts, sessionReset: true },
      ],
      updatedAt: now,
      createdAt: now,
      humanTakeover: false,
      bookingDraft: null,
      clientName: "سارة",
      currentStateName: "BOOKING",
    } as any);

    prismaMock.booking.findFirst.mockResolvedValue({
      id: "book-1",
      clientName: "سارة",
      clientPhone: "+966501234567",
      serviceName: "فيلر",
      doctorName: "د. أحمد",
      branchName: "فرع الصحافة",
      timeSlot: "09:00 ص",
      source: "WhatsApp",
      clinicId: "cmryoendy0000dzrctyxgyf3k",
      createdAt: now,
      status: "PENDING",
    } as any);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(
      createRequest("GET", `${BASE_URL}/api/conversations?clientPhone=${encodeURIComponent("+966501234567")}`)
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    // Contract: { messages: ChatMessage[], booking: Booking | null, humanTakeover: boolean }
    expect(data).toHaveProperty("messages");
    expect(data).toHaveProperty("booking");
    expect(data).toHaveProperty("humanTakeover");

    expect(Array.isArray(data.messages)).toBe(true);
    expect(typeof data.humanTakeover).toBe("boolean");

    // system messages should be filtered out
    expect(data.messages).toHaveLength(2);
    expect(data.messages.every((m: any) => m.role !== "system")).toBe(true);

    // Each message has ChatMessage shape
    for (const msg of data.messages) {
      expect(msg).toHaveProperty("role");
      expect(msg).toHaveProperty("content");
      expect(msg).toHaveProperty("timestamp");
      expect(["user", "assistant"]).toContain(msg.role);
    }

    // Booking shape
    expect(data.booking).toHaveProperty("id");
    expect(data.booking).toHaveProperty("clientName");
    expect(data.booking).toHaveProperty("clientPhone");
    expect(data.booking).toHaveProperty("serviceName");
    expect(data.booking).toHaveProperty("doctorName");
    expect(data.booking).toHaveProperty("branchName");
    expect(data.booking).toHaveProperty("timeSlot");
    expect(data.booking).toHaveProperty("status");
    expect(data.booking.status).toBe("PENDING");
  });

  it("returns booking=null and humanTakeover=false when no conversation exists", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    prismaMock.booking.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/conversations/route");
    const response = await GET(
      createRequest("GET", `${BASE_URL}/api/conversations?clientPhone=${encodeURIComponent("+966509999999")}`)
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages).toEqual([]);
    expect(data.booking).toBeNull();
    expect(data.humanTakeover).toBe(false);
  });
});

describe("POST /api/conversations — send message", () => {
  beforeEach(() => {
    prismaMock.clinic.findUnique.mockResolvedValue({
      id: "cmryoendy0000dzrctyxgyf3k",
      name: "عيادة ريفال للتجميل",
      countryCode: "SA",
      allowedCountries: "SA",
      createdAt: new Date(),
      updatedAt: new Date(),
      customPrompt: null,
      slug: "rival-clinic",
      timezone: null,
      logoUrl: null,
      wabaId: null,
      whatsappPhoneId: "123456",
      whatsappToken: "mock-iv:mock-authTag:mock-encryptedData", // 3 colon-separated parts for decrypt
      webhookVerifyToken: null,
      aiName: null,
      aiPersonality: null,
      sessionTimeoutMinutes: 30,
      campaignSource: null,
      deletedAt: null,
      bookingPageUrl: null,
    } as any);

    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.upsert.mockResolvedValue({
      id: "conv-new",
      clientPhone: "+966501234567",
      clinicId: "cmryoendy0000dzrctyxgyf3k",
      messages: [
        { role: "assistant", content: "مرحباً", timestamp: new Date().toISOString() },
      ],
      updatedAt: new Date(),
      createdAt: new Date(),
      humanTakeover: false,
      bookingDraft: null,
      clientName: null,
      currentStateName: "IDLE",
    } as any);
  });

  it("returns { success, message } shape on successful send", async () => {
    // Mock fetch for Meta API call
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    } as any);

    const { POST } = await import("@/app/api/conversations/route");
    const response = await POST(
      createRequest("POST", `${BASE_URL}/api/conversations`, {
        clientPhone: "+966501234567",
        messageText: "مرحباً، كيف يمكنني مساعدتك؟",
      })
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    // Contract: { success: boolean, message: ChatMessage }
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("message");
    expect(data.success).toBe(true);

    // message has ChatMessage shape
    expect(data.message).toHaveProperty("role");
    expect(data.message).toHaveProperty("content");
    expect(data.message).toHaveProperty("timestamp");
    expect(data.message.role).toBe("assistant");
    expect(data.message.content).toBe("مرحباً، كيف يمكنني مساعدتك؟");
  });

  it("returns 400 when clientPhone is missing", async () => {
    const { POST } = await import("@/app/api/conversations/route");
    const response = await POST(
      createRequest("POST", `${BASE_URL}/api/conversations`, {
        messageText: "مرحباً",
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when messageText is missing", async () => {
    const { POST } = await import("@/app/api/conversations/route");
    const response = await POST(
      createRequest("POST", `${BASE_URL}/api/conversations`, {
        clientPhone: "+966501234567",
      })
    );
    expect(response.status).toBe(400);
  });
});
