import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { ClinicWithCatalog, ChatMessage, sanitizeAIValue } from "@/lib/domain/types";
import { AIProvider } from "../infrastructure/ai/AIProvider";
import { BusinessEngine } from "./BusinessEngine";
import { JourneyResolver } from "./journey/JourneyResolver";
import { Logger } from "../infrastructure/logging/Logger";

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
    
    // 1. Fetch or create the conversation context
    const conversation = await prisma.conversation.findUnique({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      },
    });

    let history: ChatMessage[] = [];
    if (conversation && conversation.messages) {
      history = conversation.messages as unknown as ChatMessage[];
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentState: any = {
      clientName: activeBooking?.clientName || null,
      clientPhone: activeBooking?.clientPhone || null, // null by default, resolved to whatsapp number downstream if no custom number provided
      serviceName: activeBooking?.serviceName || null,
      doctorName: activeBooking?.doctorName || null,
      branchName: activeBooking?.branchName || null,
      timeSlot: activeBooking?.timeSlot || null
    };
    
    let startFromIndex = 0;
    for (let i = 0; i < history.length; i++) {
      if (history[i].sessionReset) {
        startFromIndex = i + 1;
      }
    }

    for (let i = startFromIndex; i < history.length; i++) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.bookingData) {
        for (const key of Object.keys(msg.bookingData)) {
          const val = sanitizeAIValue(msg.bookingData[key as keyof typeof msg.bookingData]);
          currentState[key] = val;
        }
      }
    }

    // If it's a modification/cancellation request, ensure database state overrides the history resets
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

    const llmStart = Date.now();
    try {
      aiResult = await AIProvider.classifyIntentAndExtractData(clinic, historyToModel, source, currentState);
      console.log("[DEBUG AIResult]:", JSON.stringify(aiResult, null, 2));
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
      
      // Retain previously gathered data if AI omits it
      if (aiResult.bookingData) {
        aiResult.bookingData = {
          clientName: aiResult.bookingData.clientName || currentState.clientName,
          clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone,
          serviceName: aiResult.bookingData.serviceName || currentState.serviceName,
          doctorName: aiResult.bookingData.doctorName || currentState.doctorName,
          branchName: aiResult.bookingData.branchName || currentState.branchName,
          timeSlot: aiResult.bookingData.timeSlot || currentState.timeSlot,
        };
      } else {
        aiResult.bookingData = currentState;
      }

      // 3. Process Business Rules
      const result = await BusinessEngine.processIntent(clinic, clientPhone, message, aiResult, source, currentState);
      finalResponse = result.finalResponse;
      bookingCreated = result.bookingCreated;
      bookingModified = result.bookingModified || false;
      modifiedBookingData = result.modifiedBookingData || aiResult.bookingData;
      aiResult.intent = result.resolvedIntent as any;
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

      return {
        response: "عذراً، أواجه مشكلة تقنية حالياً. سيقوم فريق الاستقبال بالرد عليك قريباً. 🌸",
        intent: "Inquiry",
        stage: "Exploration",
        policy: "General Policy"
      };
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

    // 4. Update Conversation in DB via upsert to prevent unique constraint race conditions
    await prisma.conversation.upsert({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone,
        },
      },
      update: {
        messages: history as unknown as Prisma.InputJsonValue,
      },
      create: {
        clientPhone,
        clinicId: clinic.id,
        messages: history as unknown as Prisma.InputJsonValue,
      },
    });

    const resolvedIntent = aiResult.intent === "ModifyBooking" ? "Modify Booking" : 
                           aiResult.intent === "CancelAppointment" ? "Cancel Booking" : 
                           aiResult.intent === "BookAppointment" ? "Booking" : 
                           aiResult.intent === "Objection" ? "Objection Handling" :
                           aiResult.intent;

    const resolvedStage = (aiResult.intent === "ModifyBooking" || aiResult.intent === "CancelAppointment") ? "Booking Management" :
                          JourneyResolver.resolveStage(history, currentState, aiResult.intent === "BookAppointment" ? "booking" : aiResult.intent);

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

    return {
      response: finalResponse,
      humanTakeover: aiResult.humanTakeover,
      bookingData: (bookingCreated || bookingModified) ? null : modifiedBookingData,
      bookingCreated: bookingCreated || bookingModified,
      intent: resolvedIntent,
      stage: resolvedStage,
      policy: resolvedPolicy
    };
  }
}
