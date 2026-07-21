import { prisma } from "@/lib/db";
import { AIClassificationResult } from "../infrastructure/ai/AIProvider";
import { extractSaudiPhone, normalizeToOfficial, ClinicWithCatalog } from "@/lib/domain/types";

export class BusinessEngine {
  static async processIntent(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    userMessage: string,
    aiResult: AIClassificationResult,
    source: string
  ): Promise<{ finalResponse: string; bookingCreated: boolean; modifiedBookingData?: any }> {
    let finalResponse = aiResult.response;
    let bookingCreated = false;
    const modifiedBookingData = { ...aiResult.bookingData };

    if (aiResult.intent === "BookAppointment") {
      const data = aiResult.bookingData;
      
      // Attempt to normalize
      const serviceNames = clinic.services.map((s) => s.name);
      const doctorNames = clinic.doctors.map((d) => d.name);
      const branchNames = clinic.branches.map((b) => b.name);

      const normalizedService = normalizeToOfficial(data.serviceName, serviceNames);
      const normalizedDoctor = normalizeToOfficial(data.doctorName, doctorNames) || "غير محدد";
      const normalizedBranch = normalizeToOfficial(data.branchName, branchNames);

      const hasName = data.clientName && data.clientName.trim().length > 1;
      
      console.log(`[DEBUG-PHONE] Input data.clientPhone: '${data.clientPhone}'`);
      console.log(`[DEBUG-PHONE] Fallback clientPhone: '${clientPhone}'`);
      console.log(`[DEBUG-PHONE] Passed to extractSaudiPhone: '${data.clientPhone || clientPhone}'`);
      
      const extractedPhone = extractSaudiPhone(data.clientPhone || clientPhone);
      const isPhoneValid = extractedPhone !== null;
      
      console.log(`[DEBUG-PHONE] Extracted Phone: '${extractedPhone}'`);
      console.log(`[DEBUG-PHONE] isPhoneValid: ${isPhoneValid}`);

      // Business Rule: AI believes it can book, but we enforce strict checks
      if (hasName && isPhoneValid && normalizedService && normalizedBranch && data.timeSlot) {
        
        const finalPhone = extractedPhone!;

        // Check for duplicates
        const existingBooking = await prisma.booking.findFirst({
          where: {
            clinicId: clinic.id,
            clientPhone: finalPhone,
            serviceName: normalizedService,
            doctorName: normalizedDoctor,
            branchName: normalizedBranch,
            timeSlot: data.timeSlot,
          },
        });

        if (!existingBooking) {
          await prisma.booking.create({
            data: {
              clientName: data.clientName!,
              clientPhone: finalPhone,
              serviceName: normalizedService,
              doctorName: normalizedDoctor,
              branchName: normalizedBranch,
              timeSlot: data.timeSlot,
              source: source,
              clinicId: clinic.id,
              status: "PENDING",
            },
          });
          bookingCreated = true;
          // Override finalResponse so the AI's hallucination is ignored!
          finalResponse = `وصلني طلب الحجز بنجاح 🌷\n\n✅ الاسم: ${data.clientName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${normalizedService}\n✅ الطبيب: ${normalizedDoctor}\n✅ الفرع: ${normalizedBranch}\n✅ الوقت المفضل: ${data.timeSlot}\n\nتم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر. 🌸`;
        } else {
          // Override AI response for duplicates
          finalResponse = `لدينا طلب حجز مُسجّل مسبقاً بنفس التفاصيل يا ${data.clientName} 🌷 تم إرسال طلبك بالفعل للاستقبال. إذا أردت إنشاء طلب جديد أو تعديل الحجز، أخبرني وسأبدأ معك طلبًا جديدًا.`;
        }
      } else {
        // Business Rule: The Validation Wall blocked the booking.
        // We must override the AI's response if it hallucinated completion, or if the phone is invalid.
        const isPhoneRejectionHallucination = isPhoneValid && finalResponse.match(/غير صحيح|10 أرقام/i);

        if (data.clientPhone && !isPhoneValid) {
          finalResponse = "رقم الجوال يبدو غير صحيح. أرجو إرسال رقم سعودي يبدأ بـ 05 ويتكون من 10 أرقام 🌷";
        } else if (isPhoneRejectionHallucination || finalResponse.match(/تم|نجاح|ارسال|رفع|حجز/i)) {
          const missing = [];
          if (!hasName) missing.push("الاسم");
          if (!isPhoneValid) missing.push("رقم الجوال الصحيح");
          if (!normalizedService) missing.push("الخدمة المطلوبة");
          if (!normalizedBranch) missing.push("الفرع المفضل");
          if (!data.timeSlot) missing.push("الوقت المناسب");
          
          if (missing.length > 0) {
            finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${missing.join(" و ")} 🌷`;
          }
        }
        
        // Nullify invalid data so ConversationEngine doesn't save it
        if (!hasName) modifiedBookingData.clientName = null;
        if (!isPhoneValid) modifiedBookingData.clientPhone = null;
        if (!normalizedService) modifiedBookingData.serviceName = null;
        if (!normalizedBranch) modifiedBookingData.branchName = null;
        // timeSlot is implicitly validated if present
      }
      // If AI failed to gather all data, and didn't hallucinate, we just return the AI's question back to user.
    } else if (aiResult.intent === "CancelAppointment") {
      // Future logic: lookup booking and cancel
      finalResponse = "سيتم تحويل طلب الإلغاء لموظف الاستقبال لخدمتك بشكل أفضل 🌷";
    } else if (aiResult.intent === "Inquiry") {
      if (aiResult.requiresRag) {
        const { RAGPipeline } = await import("./RAGPipeline");
        const chunks = await RAGPipeline.retrieve(clinic.id, userMessage, 3);
        finalResponse = await RAGPipeline.generateGroundedResponse(clinic, userMessage, chunks);
      } else {
        finalResponse = aiResult.response;
      }
    } else if (aiResult.intent === "HumanTakeover") {
      finalResponse = "تم تحويل المحادثة لموظف الاستقبال. سيتم الرد عليك في أقرب وقت ممكن. 👩‍💻";
    }

    // Filter out internal testing data from the final response
    if (finalResponse) {
      finalResponse = finalResponse.replace(/\s*E2E\s*/gi, " ");
      finalResponse = finalResponse.replace(/\s*التجريبي\s*/g, " ");
      finalResponse = finalResponse.replace(/\s+/g, " ").trim();
    }

    return { finalResponse, bookingCreated, modifiedBookingData };
  }
}
