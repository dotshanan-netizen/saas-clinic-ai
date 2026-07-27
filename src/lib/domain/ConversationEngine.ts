import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { ClinicWithCatalog, ChatMessage, sanitizeAIValue } from "@/lib/domain/types";
import { AIProvider } from "../infrastructure/ai/AIProvider";
import { BusinessEngine } from "./BusinessEngine";
import { JourneyResolver } from "./journey/JourneyResolver";
import { Logger } from "../infrastructure/logging/Logger";
import { ConnectionManager } from "../infrastructure/resilience/ConnectionManager";
import crypto from "crypto";

const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || "12", 10);

export class ConversationEngine {
  static async processMessage(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    message: string,
    source: string = "WhatsApp",
    requestId: string = "untracked-request"
  ): Promise<{ 
    response: string; 
    humanTakeover?: boolean; 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingData?: any; 
    bookingCreated?: boolean; 
    existingBookingFound?: boolean;
    intent?: string;
    stage?: string;
    policy?: string;
  }> {
    const redis = ConnectionManager.getRedisConnection("conversation-lock");
    const lockKey = `lock:conversation:${clinic.id}:${clientPhone}`;
    let lockValue = "";
    let acquired = false;

    try {
      lockValue = crypto.randomUUID();
      const lockTimeoutMs = 15000;
      for (let i = 0; i < 5; i++) {
        const result = await redis.set(lockKey, lockValue, "PX", lockTimeoutMs, "NX");
        if (result === "OK") {
          acquired = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }
    } catch (err: any) {
      console.warn(`[RedisLock] Failed to acquire lock: ${err.message}. Proceeding without lock.`);
    }

    try {
      // Production Hardening: Guard against empty/invalid messages.
      // Prevents unnecessary AI calls (wasted tokens + latency) when message
      // is missing or whitespace-only.
      if (!message || message.trim().length === 0) {
        Logger.warn(`[ConversationEngine] Empty message from ${clientPhone}, skipping AI call.`);
        return {
          response: "",
          intent: "EmptyMessage",
          stage: "IDLE",
          policy: "General Policy"
        };
      }

      // 1. Fetch or create the conversation context
      const conversation = await prisma.conversation.findUnique({
        where: {
          clinicId_clientPhone: {
            clinicId: clinic.id,
            clientPhone: clientPhone,
          },
        },
      });

      // Capture bookingDraft BEFORE any modifications for diagnostic logging
      const bookingDraftBefore = conversation?.bookingDraft ? JSON.parse(JSON.stringify(conversation.bookingDraft)) : null;

      let history: ChatMessage[] = [];
      if (conversation && conversation.messages) {
        history = conversation.messages as unknown as ChatMessage[];
      
      // Phase 1: Check lastInteraction timeout (15 mins)
      const lastInteraction = conversation.updatedAt.getTime();
      const now = Date.now();
      if (now - lastInteraction > 15 * 60 * 1000) {
        history.push({
          role: "system",
          content: "SESSION_TIMEOUT_RESET",
          timestamp: new Date().toISOString(),
          sessionReset: true
        });
        Logger.info(`[ConversationEngine] Session timed out for ${clientPhone}, resetting state.`);
        if (conversation) {
          conversation.bookingDraft = null;
          conversation.currentStateName = "IDLE";
        }
      }
    }

    // Check if Human Takeover is active
    if (conversation && conversation.humanTakeover) {
      Logger.info(`[ConversationEngine] Human Takeover is active for ${clientPhone}. Skipping AI.`, { 
        requestId,
        clinicId: clinic.id, 
        clientPhone 
      });
      // Just record the user message and return without a response
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
        messageId: requestId !== "untracked-request" ? requestId : undefined,
      };
      history.push(userMsg);
      
      const MAX_DB_MESSAGES = 50;
      const historyToSave = history.length > MAX_DB_MESSAGES ? history.slice(-MAX_DB_MESSAGES) : history;
      
      await prisma.conversation.upsert({
        where: {
          clinicId_clientPhone: {
            clinicId: clinic.id,
            clientPhone,
          },
        },
        update: {
          messages: historyToSave as unknown as Prisma.InputJsonValue,
        },
        create: {
          clientPhone,
          clinicId: clinic.id,
          messages: historyToSave as unknown as Prisma.InputJsonValue,
          humanTakeover: true,
        },
      });

      return {
        response: "", // Return empty string so no message is sent via Meta
        humanTakeover: true,
        intent: "HumanTakeoverActive",
        stage: "Human Mode",
        policy: "Human Policy"
      };
    }

    // 1.5 Deduplication Check (Business-Level Idempotency)
    // Prevents Worker/Queue retries from sending duplicate AI responses
    if (requestId && requestId !== "untracked-request") {
      const existingUserMsgIndex = history.findIndex(msg => msg.messageId === requestId);
      if (existingUserMsgIndex !== -1) {
        Logger.info(`[ConversationEngine] Deduplicated repeated messageId: ${requestId}`, { requestId, clinicId: clinic.id, clientPhone });
        let recoveredResponse = "عذراً، تم استلام رسالتك مسبقاً وهي قيد المعالجة. 🌸";
        if (existingUserMsgIndex + 1 < history.length && history[existingUserMsgIndex + 1].role === "assistant") {
          recoveredResponse = history[existingUserMsgIndex + 1].content;
        }
        return { 
          response: recoveredResponse,
          intent: "Duplicate",
          stage: "Duplicate",
          policy: "Duplicate"
        };
      }
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      messageId: requestId !== "untracked-request" ? requestId : undefined,
    };
    history.push(userMsg);

    // Reconstruct current booking state safely (avoiding null/fake string overwrites)
    const isModificationOrCancel = message.match(/تغيير|تعديل|أغير|أعدل|خليه|بدل|غيرت|أنقل|نقل|أحول|تحويل|ألغي|إلغاء|كنسل|بلاش|تراجع|تراجعت|رأيي|ما أبي|ما ابى|انسى|انس|طنش|خلاص/i);
    let activeBooking = null;
    if (isModificationOrCancel) {
      activeBooking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
          status: { in: ["PENDING", "CONFIRMED"] }
        },
        orderBy: { createdAt: "desc" }
      });
    }

    // 1.6 Reconstruct current booking state per Customer Memory Policy Matrix:
    // Persistent profile fields (Name, Phone) persist across conversations.
    // Transient booking fields (Service, Doctor, Branch, Time) are isolated to the active session.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentState: any = {
      clientName: conversation?.clientName || activeBooking?.clientName || null,
      clientPhone: activeBooking?.clientPhone || null,
      serviceName: isModificationOrCancel ? (activeBooking?.serviceName || null) : null,
      doctorName: isModificationOrCancel ? (activeBooking?.doctorName || null) : null,
      branchName: isModificationOrCancel ? (activeBooking?.branchName || null) : null,
      timeSlot: isModificationOrCancel ? (activeBooking?.timeSlot || null) : null
    };

    // Load active transient state directly from bookingDraft JSON Column only if not expired (15 minutes)
    const DRAFT_EXPIRATION_MS = 15 * 60 * 1000;
    const isDraftExpired = conversation?.updatedAt
      ? (Date.now() - new Date(conversation.updatedAt).getTime() > DRAFT_EXPIRATION_MS)
      : true;

    // P2: Selective draft restoration — restore identity and service-selection
    // fields (name, phone, service, doctor, branch) but NOT timeSlot.
    // timeSlot must be freshly extracted by the AI each turn from the user's
    // message or conversation history. Blindly restoring timeSlot from draft
    // allows stale values to prime the AI prompt (AIProvider.ts:112) and
    // feed into the merge pipeline, enabling the G1→G2→G3 feedback loop.
    // Per TIME_PIPELINE_HARDENING_PLAN.md §P2, this closes R4.
    if (conversation && conversation.bookingDraft && !isDraftExpired) {
      const { timeSlot: _staleTimeSlot, ...safeDraftFields } = conversation.bookingDraft as any;
      currentState = {
        ...currentState,
        ...safeDraftFields,
      };
    }

    // If it's a modification/cancellation request, ensure database state overrides draft
    if (isModificationOrCancel && activeBooking) {
      currentState.clientName = activeBooking.clientName;
      currentState.clientPhone = activeBooking.clientPhone;
      currentState.serviceName = activeBooking.serviceName;
      currentState.doctorName = activeBooking.doctorName;
      currentState.branchName = activeBooking.branchName;
      currentState.timeSlot = activeBooking.timeSlot;
    }

    const startTime = Date.now();
    Logger.info("Request received", { requestId, clinicId: clinic.id, clientPhone, userMessage: message, source });

    // 2. Classify Intent and Extract Data via AI
    // Send only the active history (after the last sessionReset) to prevent state leakage
    let lastResetIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sessionReset) {
        lastResetIndex = i;
        break;
      }
    }
    const activeHistory = history.slice(lastResetIndex + 1);

    // Apply MAX_CONTEXT_MESSAGES sliding window config
    const historyToModel = activeHistory.slice(-MAX_CONTEXT_MESSAGES);

    let aiResult;
    let finalResponse;
    let bookingCreated;
    let bookingModified = false;
    let modifiedBookingData;
    let llmLatency = 0;

    // Fetch dynamic slots if a doctor is currently selected
    let availableSlotsText = "";
    if (currentState.doctorName) {
      const { BookingService } = await import("@/lib/domain/BookingService");
      const slotsData = await BookingService.getAvailableSlots(clinic.id, currentState.doctorName as string);
      
      const lines = [];
      for (const [day, times] of Object.entries(slotsData)) {
        lines.push(`${day}: ${times.join(" - ")}`);
      }
      availableSlotsText = lines.join("\n");
      if (!availableSlotsText) {
        availableSlotsText = "لا توجد أوقات متاحة لهذا الطبيب حالياً.";
      }
    }

    // Fetch Business Profile (GENERAL_INFO) from KB
    let businessProfile = "";
    try {
      const kbItem = await prisma.knowledgeBase.findFirst({
        where: { clinicId: clinic.id, category: "GENERAL_INFO", deletedAt: null },
      });
      if (kbItem) {
        businessProfile = kbItem.content;
      }
    } catch (e) {
      Logger.error("Failed to fetch business profile from KB", e, { requestId, clinicId: clinic.id, clientPhone });
    }

    const llmStart = Date.now();
    try {
      aiResult = await AIProvider.classifyIntentAndExtractData(clinic, historyToModel, source, currentState, availableSlotsText, businessProfile);
      llmLatency = Date.now() - llmStart;

      // Log LLM Latency & Token Metrics
      Logger.metric("llm_latency_ms", llmLatency, { requestId, clinicId: clinic.id, clientPhone });
      if (aiResult.usage) {
        Logger.metric("prompt_tokens", aiResult.usage.promptTokens, { requestId, clinicId: clinic.id, clientPhone });
        Logger.metric("completion_tokens", aiResult.usage.completionTokens, { requestId, clinicId: clinic.id, clientPhone });
        Logger.metric("total_tokens", aiResult.usage.totalTokens, { requestId, clinicId: clinic.id, clientPhone });
      }

      // Check performance threshold for LLM Latency (warn if > 3s)
      if (llmLatency > 3000) {
        Logger.info(`[Performance Warning] LLM Latency exceeded 3000ms threshold: ${llmLatency}ms`, { requestId, clinicId: clinic.id, clientPhone, llmLatency });
      }
      
      // Retain previously gathered data if AI omits it.
      // ARCHITECTURAL RULE: Intent-Aware Merge.
      // - Booking intents (BookAppointment, ModifyBooking): Full merge from
      //   currentState to handle AI omissions during multi-turn booking flows,
      //   WITH a Time Merge Guard (P1) on timeSlot: only fall through to
      //   currentState.timeSlot when the user's message contains time keywords.
      // - Non-booking intents (Inquiry, Complaint, etc.): Identity-only merge.
      //   Booking fields are explicitly nulled to prevent stale state contamination.
      //   The BusinessEngine Active Session Gate then correctly detects that
      //   no booking activity is happening and resets the stale fields.
      // - P1 Time Merge Guard: Prevents stale bookingDraft timeSlot values from
      //   leaking through the Intent-Aware Merge when the user is talking about
      //   something unrelated (TIME_PIPELINE_HARDENING_PLAN.md §P1).
      const isBookingIntent = aiResult.intent === "BookAppointment" || aiResult.intent === "ModifyBooking";
      if (aiResult.bookingData) {
        if (isBookingIntent) {
          // P1 Guard: only fall through to currentState.timeSlot if user mentions time
          const hasTimeKeyword = !!message.match(
            /الساعة|الساعه|السعة|موعد|وقت|بكرة|بكرا|اليوم|الصبح|المساء|الظهر|العصر|المغرب|العشاء|الليل/i
          );
          aiResult.bookingData = {
            clientName: aiResult.bookingData.clientName || currentState.clientName,
            clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone,
            serviceName: aiResult.bookingData.serviceName || currentState.serviceName,
            doctorName: aiResult.bookingData.doctorName || currentState.doctorName,
            branchName: aiResult.bookingData.branchName || currentState.branchName,
            timeSlot: aiResult.bookingData.timeSlot || (hasTimeKeyword ? currentState.timeSlot : null),
          };
        } else {
          // Identity-only: preserve customer identity, null out transient booking fields
          aiResult.bookingData = {
            clientName: aiResult.bookingData.clientName || currentState.clientName,
            clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone,
            serviceName: null,
            doctorName: null,
            branchName: null,
            timeSlot: null,
          };
        }
      } else {
        // AI returned no bookingData at all — use intent to decide fallback
        aiResult.bookingData = isBookingIntent
          ? currentState
          : {
              clientName: currentState.clientName,
              clientPhone: currentState.clientPhone,
              serviceName: null,
              doctorName: null,
              branchName: null,
              timeSlot: null,
            };
      }

      // Phase 1: Explicitly clear state and reset if non-booking intent (Inquiry, Complaint, Objection, Unknown, etc.)
      const nonBookingIntents = ["Inquiry", "Complaint", "Objection", "Unknown", "unknown", "HumanTakeover"];
      if (nonBookingIntents.includes(aiResult.intent) || (!aiResult.intent && !isBookingIntent)) {
         currentState.serviceName = null;
         currentState.doctorName = null;
         currentState.branchName = null;
         currentState.timeSlot = null;
         history.push({
           role: "system",
           content: "INTENT_RESET",
           timestamp: new Date().toISOString(),
           sessionReset: true
         });
      }


      // 3. Process Business Rules
      const result = await BusinessEngine.processIntent(clinic, clientPhone, message, aiResult, source, currentState);
      finalResponse = result.finalResponse;
      bookingCreated = result.bookingCreated;
      bookingModified = result.bookingModified || false;
      modifiedBookingData = result.modifiedBookingData || aiResult.bookingData;
      aiResult.intent = result.resolvedIntent as import("@/lib/infrastructure/ai/AIProvider").AIIntent;

      // Structured trace available in result.trace and result.immutableContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      llmLatency = Date.now() - llmStart;
      const totalLatency = Date.now() - startTime;

      // Log AI Fallback metrics and errors
      Logger.metric("fallback_triggers", 1, { requestId, clinicId: clinic.id, clientPhone });
      Logger.metric("error_count", 1, { requestId, clinicId: clinic.id, clientPhone });
      Logger.metric("total_latency_ms", totalLatency, { requestId, clinicId: clinic.id, clientPhone });

      Logger.error("AI Provider failed, invoking fallback handler", error, {
        requestId,
        clinicId: clinic.id,
        clientPhone,
        llmLatency,
        totalLatency,
        errorCode: error.code || "AI_FAILURE"
      });

      finalResponse = "عذراً، أواجه مشكلة تقنية حالياً. سيقوم فريق الاستقبال بالرد عليك قريباً. 🌸";
      aiResult = {
        intent: "HumanTakeover",
        response: finalResponse,
        humanTakeover: true,
        requiresRag: false,
      } as any;
      
      bookingCreated = false;
      bookingModified = false;
      modifiedBookingData = currentState;
    }

    // Save assistant message to history
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: finalResponse,
      timestamp: new Date().toISOString(),
      bookingData: (bookingCreated || bookingModified) ? null : modifiedBookingData,
      sessionReset: bookingCreated || bookingModified
    };
    history.push(assistantMsg);

    const resolvedStage = JourneyResolver.transition(
      conversation?.currentStateName || "IDLE",
      aiResult.intent || "Unknown",
      !!(bookingCreated || bookingModified),
      currentState
    );

    // 4. Update Conversation in DB via upsert to prevent unique constraint race conditions
    const MAX_DB_MESSAGES = 50;
    const historyToSave = history.length > MAX_DB_MESSAGES ? history.slice(-MAX_DB_MESSAGES) : history;

    const draftToSave = (bookingCreated || bookingModified) ? null : modifiedBookingData;
    const clientNameNew = modifiedBookingData?.clientName || currentState.clientName || conversation?.clientName || null;

    await prisma.conversation.upsert({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone,
        },
      },
      update: {
        messages: historyToSave as unknown as Prisma.InputJsonValue,
        humanTakeover: aiResult.humanTakeover ? true : undefined,
        bookingDraft: draftToSave as unknown as Prisma.InputJsonValue,
        clientName: clientNameNew,
        currentStateName: resolvedStage,
      },
      create: {
        clientPhone,
        clinicId: clinic.id,
        messages: historyToSave as unknown as Prisma.InputJsonValue,
        humanTakeover: aiResult.humanTakeover ? true : false,
        bookingDraft: draftToSave as unknown as Prisma.InputJsonValue,
        clientName: clientNameNew,
        currentStateName: resolvedStage,
      },
    });

    const resolvedIntent = aiResult.intent === "ModifyBooking" ? "Modify Booking" : 
                           aiResult.intent === "CancelAppointment" ? "Cancel Booking" : 
                           aiResult.intent === "BookAppointment" ? "Booking" : 
                           aiResult.intent === "Objection" ? "Objection Handling" :
                           aiResult.intent;

    const resolvedPolicy = aiResult.intent === "ModifyBooking" ? "Modification Policy" :
                           aiResult.intent === "CancelAppointment" ? "Cancellation Policy" :
                           aiResult.intent === "BookAppointment" ? "Booking Policy" :
                           aiResult.intent === "HumanTakeover" ? "Human Policy" :
                           aiResult.intent === "Complaint" ? "Human Policy" :
                           "General Policy";

    const totalLatency = Date.now() - startTime;
    Logger.metric("total_latency_ms", totalLatency, { requestId, clinicId: clinic.id, clientPhone });

    // Check performance threshold for total latency (warn if > 5s)
    if (totalLatency > 5000) {
      Logger.info(`[Performance Warning] Total Latency exceeded 5000ms threshold: ${totalLatency}ms`, { requestId, clinicId: clinic.id, clientPhone, totalLatency });
    }

    Logger.info("Request processed successfully", { requestId, clinicId: clinic.id, clientPhone, intent: resolvedIntent, stage: resolvedStage, policy: resolvedPolicy, totalLatency });

    console.log(JSON.stringify({
      event: "PIPELINE_RESULT",
      requestId,
      response: finalResponse,
      timeSlot: modifiedBookingData?.timeSlot || null,
      bookingCreated: bookingCreated || bookingModified,
      intent: resolvedIntent,
      stage: resolvedStage,
      policy: resolvedPolicy,
    }));

      return {
        response: finalResponse,
        humanTakeover: aiResult.humanTakeover,
        bookingData: (bookingCreated || bookingModified) ? null : modifiedBookingData,
        bookingCreated: bookingCreated || bookingModified,
        intent: resolvedIntent,
        stage: resolvedStage,
        policy: resolvedPolicy
      };
    } finally {
      if (acquired) {
        try {
          const currentVal = await redis.get(lockKey);
          if (currentVal === lockValue) {
            await redis.del(lockKey);
          }
        } catch (err: any) {
          console.warn(`[RedisLock] Failed to release lock: ${err.message}`);
        }
      }
    }
  }
}
