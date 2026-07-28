import { describe, it, expect } from "vitest";
import { filterActiveHistory } from "../../lib/domain/ConversationEngine";
import type { ChatMessage } from "../../lib/domain/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function msg(role: ChatMessage["role"], content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function userMsg(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return msg("user", content, overrides);
}

function assistantMsg(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return msg("assistant", content, overrides);
}

function systemReset(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return msg("system", content, { sessionReset: true, ...overrides });
}

function bookingData(clientName = "سميرة", serviceName = "بوتكس لات", doctorName = "د. سحر", branchName = "فرع الصحافة", timeSlot = "الإثنين (27 يوليو) 09:00 م"): ChatMessage["bookingData"] {
  return { clientName, clientPhone: "+966501234567", serviceName, doctorName, branchName, timeSlot };
}

// ── filterActiveHistory ─────────────────────────────────────────────────────

describe("filterActiveHistory — session boundary isolation", () => {
  // ── BASE CASES ─────────────────────────────────────────────────────────

  describe("base cases", () => {
    it("should return empty array when history is empty", () => {
      expect(filterActiveHistory([])).toEqual([]);
    });

    it("should return full history when no sessionReset marker exists", () => {
      const history = [
        userMsg("السلام عليكم"),
        assistantMsg("وعليكم السلام"),
        userMsg("أريد حجز"),
        assistantMsg("حاضر"),
      ];
      expect(filterActiveHistory(history)).toEqual(history);
    });

    it("should return full history for a single message", () => {
      const history = [userMsg("مرحبا")];
      expect(filterActiveHistory(history)).toEqual(history);
    });
  });

  // ── SESSION TIMEOUT — BOUNDARY FILTERING ───────────────────────────────

  describe("session timeout — previous messages discarded", () => {
    it("should discard all messages before SESSION_TIMEOUT_RESET", () => {
      const history = [
        userMsg("أريد حجز موعد", { bookingData: bookingData() }),
        assistantMsg("حاضر، ما هي الخدمة؟", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("بوتكس"),
        systemReset("SESSION_TIMEOUT_RESET"),
        userMsg("السلام عليكم ورحمة الله"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(result[0].content).toBe("السلام عليكم ورحمة الله");
    });

    it("should keep only messages after the latest sessionReset", () => {
      const history = [
        userMsg("محادثة قديمة"),
        systemReset("SESSION_TIMEOUT_RESET"),
        userMsg("بداية جديدة", { bookingData: { clientName: "سميرة" } }),
        assistantMsg("أهلاً سميرة"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("بداية جديدة");
      expect(result[1].content).toBe("أهلاً سميرة");
    });
  });

  // ── TRANSIENT ENTITY LEAKAGE PREVENTION ───────────────────────────────

  describe("transient entity leakage prevention", () => {
    it("must NOT leak doctorName across session boundary", () => {
      const previousSession = [
        userMsg("أريد حجز بوتكس", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: "د. سحر", branchName: null, timeSlot: null } }),
        assistantMsg("د. سحر متاحة", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: "د. سحر", branchName: null, timeSlot: null } }),
      ];
      const timeoutReset = systemReset("SESSION_TIMEOUT_RESET");
      const newSession = [userMsg("السلام عليكم")];
      const history = [...previousSession, timeoutReset, ...newSession];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(1);
      // The assistant message with doctorName="د. سحر" must NOT be in the result
      const anyDoctorRef = result.some(m =>
        m.bookingData?.doctorName === "د. سحر" ||
        m.content.includes("د. سحر")
      );
      expect(anyDoctorRef).toBe(false);
    });

    it("must NOT leak serviceName across session boundary", () => {
      const previousSession = [
        userMsg("أريد حجز", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
        assistantMsg("لقد اخترت بوتكس لات", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("أي دكتورة تشتغل؟", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
      ];
      // INTENT_RESET from the Inquiry inside the SAME session
      const intentReset = systemReset("INTENT_RESET");
      const postResetAssistant = assistantMsg("تتوفر د. سارة ود. سحر", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } });
      const timeoutReset = systemReset("SESSION_TIMEOUT_RESET");
      const newSession = [userMsg("السلام عليكم ورحمة الله")];
      const history = [...previousSession, intentReset, postResetAssistant, timeoutReset, ...newSession];

      const result = filterActiveHistory(history);
      // session boundary should be at SESSION_TIMEOUT_RESET, so only the new greeting
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("السلام عليكم ورحمة الله");
    });

    it("must NOT leak branchName across session boundary", () => {
      const history = [
        userMsg("بوتكس", { bookingData: bookingData("سميرة", "بوتكس لات", null, null, null) }),
        assistantMsg("أي فرع تفضلين؟", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("الصحافة", { bookingData: bookingData("سميرة", "بوتكس لات", null, "فرع الصحافة", null) }),
        assistantMsg("تمام", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: "فرع الصحافة", timeSlot: null } }),
        systemReset("SESSION_TIMEOUT_RESET"),
        userMsg("هلا"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("هلا");
    });

    it("must NOT leak timeSlot across session boundary", () => {
      const history = [
        userMsg("باكرة الساعة 9", { bookingData: bookingData("سميرة", "بوتكس لات", "د. سحر", "فرع الصحافة", "الإثنين (27 يوليو) 09:00 م") }),
        assistantMsg("تم تحديد الوقت", { bookingData: bookingData("سميرة", "بوتكس لات", "د. سحر", "فرع الصحافة", "الإثنين (27 يوليو) 09:00 م") }),
        systemReset("SESSION_TIMEOUT_RESET"),
        userMsg("أهلاً"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("أهلاً");
    });
  });

  // ── INTENT_RESET PRESERVATION ─────────────────────────────────────────

  describe("INTENT_RESET behavior", () => {
    it("should find the latest sessionReset even when multiple exist", () => {
      const sb1 = systemReset("SESSION_TIMEOUT_RESET");
      const sb2 = systemReset("INTENT_RESET");
      const history = [
        userMsg("قديم"),
        sb1,
        userMsg("منتصف"),
        sb2,
        userMsg("جديد"),
        assistantMsg("تمام"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("جديد");
      expect(result[1].content).toBe("تمام");
    });

    it("should use INTENT_RESET as session boundary when no timeout reset exists", () => {
      const history = [
        userMsg("خاصني", { bookingData: bookingData() }),
        assistantMsg("تم الرد", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        systemReset("INTENT_RESET"),
        userMsg("أنا باقي هنا", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("أنا باقي هنا");
    });
  });

  // ── BOOKING COMPLETION BOUNDARY ───────────────────────────────────────

  describe("booking completion boundary", () => {
    it("should discard messages before booking completion (sessionReset on assistantMsg)", () => {
      const history = [
        userMsg("أريد حجز"),
        assistantMsg("تم الحجز بنجاح ✅", { sessionReset: true }),
        userMsg("شكراً"),
        assistantMsg("العفو"),
      ];

      const result = filterActiveHistory(history);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("شكراً");
      expect(result[1].content).toBe("العفو");
    });
  });

  // ── REALISTIC PILOT SCENARIO ─────────────────────────────────────────

  describe("realistic pilot scenario: full lifecycle", () => {
    it("Samira timeout+new booking — no transient leakage", () => {
      // Simulates the forensic report's Session 2 → Session 3 transition
      // (10-hour timeout between user messages 37 and 38)

      // Session 2 (old — has booking data with service, doctor, branch, time)
      const session2: ChatMessage[] = [
        userMsg("أريد الحجز", { bookingData: { clientName: "سميرة", clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        assistantMsg("رقم الجوال يبدو غير صحيح", { bookingData: { clientName: "سميرة", clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("0501234567", { bookingData: { clientName: null, clientPhone: "+9660501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        assistantMsg("يا هلا بكِ في عيادة ريفال!", { bookingData: { clientName: null, clientPhone: "+966501234567", serviceName: null, doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("بوتكس", { bookingData: { clientName: null, clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
        assistantMsg("من عيوني! أي فرع تفضلين؟", { bookingData: { clientName: null, clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: null, timeSlot: null } }),
        userMsg("الصحافة", { bookingData: { clientName: null, clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: null, branchName: "فرع الصحافة", timeSlot: null } }),
        assistantMsg("تمام، د. سحر متاحة", { bookingData: { clientName: null, clientPhone: "+966501234567", serviceName: "بوتكس لات", doctorName: "د. سحر", branchName: "فرع الصحافة", timeSlot: null } }),
      ];

      // Session timeout boundary
      const sessionBoundary = systemReset("SESSION_TIMEOUT_RESET");

      // Session 3 (new — should start fresh, no transient entities leaking)
      const session3: ChatMessage[] = [
        userMsg("اهلا"),
      ];

      const history = [...session2, sessionBoundary, ...session3];
      const result = filterActiveHistory(history);

      // Only the new "اهلا" message should remain
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("اهلا");

      // No transient booking entities in the result
      const hasService = result.some(m => m.bookingData?.serviceName != null);
      const hasDoctor = result.some(m => m.bookingData?.doctorName != null);
      const hasBranch = result.some(m => m.bookingData?.branchName != null);
      const hasTime = result.some(m => m.bookingData?.timeSlot != null);
      expect(hasService).toBe(false);
      expect(hasDoctor).toBe(false);
      expect(hasBranch).toBe(false);
      expect(hasTime).toBe(false);
    });
  });
});
