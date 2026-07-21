import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { ClinicWithCatalog, ChatMessage } from "@/lib/domain/types";
import { AIProvider } from "../infrastructure/ai/AIProvider";
import { BusinessEngine } from "./BusinessEngine";

export class ConversationEngine {
  static async processMessage(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    message: string,
    source: string = "WhatsApp"
  ): Promise<{ response: string; humanTakeover?: boolean; bookingData?: any; bookingCreated?: boolean; existingBookingFound?: boolean }> {
    
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
    const currentState: any = {
      clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null
    };
    
    const { sanitizeAIValue } = require("@/lib/domain/types");

    for (const msg of history) {
      if (msg.sessionReset) {
        // Reset booking details but keep client identity
        currentState.serviceName = null;
        currentState.doctorName = null;
        currentState.branchName = null;
        currentState.timeSlot = null;
      }
      if (msg.role === "assistant" && msg.bookingData) {
        for (const key of Object.keys(msg.bookingData)) {
          const val = sanitizeAIValue(msg.bookingData[key as keyof typeof msg.bookingData]);
          if (val) {
            currentState[key] = val;
          }
        }
      }
    }

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

    let aiResult;
    let finalResponse;
    let bookingCreated;
    let modifiedBookingData;
    try {
      aiResult = await AIProvider.classifyIntentAndExtractData(clinic, activeHistory, source, currentState);
      
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
      const result = await BusinessEngine.processIntent(clinic, clientPhone, message, aiResult, source);
      finalResponse = result.finalResponse;
      bookingCreated = result.bookingCreated;
      modifiedBookingData = result.modifiedBookingData || aiResult.bookingData;
    } catch (error) {
      console.error("AI Provider failed, returning fallback message:", error);
      return { response: "عذراً، أواجه مشكلة تقنية حالياً. سيقوم فريق الاستقبال بالرد عليك قريباً." };
    }

    // Save assistant message to history
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: finalResponse,
      timestamp: new Date().toISOString(),
      bookingData: bookingCreated ? null : modifiedBookingData,
      sessionReset: bookingCreated
    };
    history.push(assistantMsg);

    // 4. Update Conversation in DB
    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { messages: history as unknown as Prisma.InputJsonValue },
      });
    } else {
      await prisma.conversation.create({
        data: {
          clientPhone,
          clinicId: clinic.id,
          messages: history as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return {
      response: finalResponse,
      humanTakeover: aiResult.humanTakeover,
      bookingData: aiResult.bookingData,
      bookingCreated: bookingCreated
    };
  }
}
