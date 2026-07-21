import { prisma } from "@/lib/db";
import { AIClassificationResult } from "../infrastructure/ai/AIProvider";
import {
  ClinicWithCatalog,
  validateBookingData,
  sanitizeAIValue,
  normalizeToOfficial,
} from "@/lib/domain/types";

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

    // Sanitize all extracted booking fields from AI first
    const rawData = aiResult.bookingData || {
      clientName: null,
      clientPhone: null,
      serviceName: null,
      doctorName: null,
      branchName: null,
      timeSlot: null,
    };

    const sanitizedData = {
      clientName: sanitizeAIValue(rawData.clientName),
      clientPhone: sanitizeAIValue(rawData.clientPhone),
      serviceName: sanitizeAIValue(rawData.serviceName),
      doctorName: sanitizeAIValue(rawData.doctorName),
      branchName: sanitizeAIValue(rawData.branchName),
      timeSlot: sanitizeAIValue(rawData.timeSlot),
    };

    const modifiedBookingData = { ...sanitizedData };

    if (aiResult.intent === "BookAppointment") {
      // 1. Controlled Merge Guard: Prevent AI from mutating unmentioned fields
      // Check if user explicitly mentioned a branch or service in their text
      const branchNames = clinic.branches.map((b) => b.name);
      const serviceNames = clinic.services.map((s) => s.name);
      const doctorNames = clinic.doctors.map((d) => d.name);

      const userBranchMention = normalizeToOfficial(userMessage, branchNames);
      const userServiceMention = normalizeToOfficial(userMessage, serviceNames);
      const userDoctorMention = normalizeToOfficial(userMessage, doctorNames);

      // If user did NOT mention a branch in their message, reject any AI-mutated branch change
      if (!userBranchMention && sanitizedData.branchName) {
        // Only keep if it matches user's text; otherwise don't let AI invent a branch
        const isBranchInText = branchNames.some((b) => userMessage.includes(b));
        if (!isBranchInText) {
          sanitizedData.branchName = null;
          modifiedBookingData.branchName = null;
        }
      }

      if (!userServiceMention && sanitizedData.serviceName) {
        const isServiceInText = serviceNames.some((s) => userMessage.includes(s));
        if (!isServiceInText) {
          sanitizedData.serviceName = null;
          modifiedBookingData.serviceName = null;
        }
      }

      if (!userDoctorMention && sanitizedData.doctorName) {
        const isDoctorInText = doctorNames.some((d) => userMessage.includes(d));
        if (!isDoctorInText) {
          sanitizedData.doctorName = null;
          modifiedBookingData.doctorName = null;
        }
      }

      // 2. Execute Central Validation Gate
      const validation = validateBookingData(sanitizedData, clientPhone, clinic);

      console.log(`[ValidationGate] isValid: ${validation.isValid}`);
      console.log(`[ValidationGate] Missing: ${validation.missingFields.join(", ")}`);
      console.log(`[ValidationGate] CleanName: '${validation.cleanName}'`);

      if (validation.isValid) {
        const finalPhone = validation.normalizedPhone!;

        // Check for duplicates
        const existingBooking = await prisma.booking.findFirst({
          where: {
            clinicId: clinic.id,
            clientPhone: finalPhone,
            serviceName: validation.normalizedService!,
            doctorName: validation.normalizedDoctor!,
            branchName: validation.normalizedBranch!,
            timeSlot: validation.cleanTimeSlot!,
          },
        });

        if (!existingBooking) {
          await prisma.booking.create({
            data: {
              clientName: validation.cleanName!,
              clientPhone: finalPhone,
              serviceName: validation.normalizedService!,
              doctorName: validation.normalizedDoctor!,
              branchName: validation.normalizedBranch!,
              timeSlot: validation.cleanTimeSlot!,
              source: source,
              clinicId: clinic.id,
              status: "PENDING",
            },
          });
          bookingCreated = true;
          // Hard Guarantee: Only send success message if validation.isValid is true!
          finalResponse = `وصلني طلب الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${validation.normalizedDoctor}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر. 🌸`;
        } else {
          finalResponse = `لدينا طلب حجز مُسجّل مسبقاً بنفس التفاصيل يا ${validation.cleanName} 🌷 تم إرسال طلبك بالفعل للاستقبال. إذا أردت إنشاء طلب جديد أو تعديل الحجز، أخبرني وسأبدأ معك طلبًا جديدًا.`;
        }
      } else {
        // HARD GATE BLOCKED BOOKING: Ensure AI never claims booking succeeded
        const isHallucinatedSuccess = finalResponse.match(/تم|نجاح|ارسال|رفع|وصلني|حجز/i);

        if (sanitizedData.clientPhone && !validation.normalizedPhone) {
          finalResponse =
            "رقم الجوال يبدو غير صحيح. أرجو إرسال رقم سعودي يبدأ بـ 05 ويتكون من 10 أرقام 🌷";
        } else if (isHallucinatedSuccess || validation.missingFields.length > 0) {
          finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${validation.missingFields.join(" و ")} 🌷`;
        }

        // Nullify missing fields in DTO
        if (validation.missingFields.includes("الاسم")) modifiedBookingData.clientName = null;
        if (validation.missingFields.includes("رقم الجوال الصحيح")) modifiedBookingData.clientPhone = null;
        if (validation.missingFields.includes("الخدمة المطلوبة")) modifiedBookingData.serviceName = null;
        if (validation.missingFields.includes("الفرع المفضل")) modifiedBookingData.branchName = null;
        if (validation.missingFields.includes("الوقت المناسب")) modifiedBookingData.timeSlot = null;
      }
    } else if (aiResult.intent === "CancelAppointment") {
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

    // Clean internal test tags from final response
    if (finalResponse) {
      finalResponse = finalResponse.replace(/\s*E2E\s*/gi, " ");
      finalResponse = finalResponse.replace(/\s*التجريبي\s*/g, " ");
      finalResponse = finalResponse.replace(/\s+/g, " ").trim();
    }

    return { finalResponse, bookingCreated, modifiedBookingData };
  }
}
