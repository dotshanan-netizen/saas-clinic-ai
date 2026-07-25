import { Prisma } from "@/generated/prisma";
import { prisma } from "../db";
import { ClinicWithCatalog, ExtractedBookingData, validateBookingData, extractSaudiPhone } from "./types";
import { Logger } from "../infrastructure/logging/Logger";

function normalizeToOfficial(extracted: string | null, officialList: string[]): string | null {
  if (!extracted) return null;
  const clean = extracted.trim().toLowerCase();
  const exact = officialList.find((o) => o.toLowerCase() === clean);
  if (exact) return exact;
  const partial = officialList.find(
    (o) => o.toLowerCase().includes(clean) || clean.includes(o.toLowerCase())
  );
  if (partial) return partial;
  return null;
}

export class BusinessEngine {
  static async processIntent(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    userMessage: string,
    aiResult: {
      intent: string;
      bookingData: ExtractedBookingData | null;
      requiresRag: boolean;
      response: string;
      humanTakeover: boolean;
    },
    source: string,
    currentState?: ExtractedBookingData
  ): Promise<{
    finalResponse: string;
    bookingCreated: boolean;
    bookingModified: boolean;
    modifiedBookingData: ExtractedBookingData | null;
    resolvedIntent: string;
  }> {
    let finalResponse = aiResult.response;
    let bookingCreated = false;
    let bookingModified = false;
    let modifiedBookingData: ExtractedBookingData | null = aiResult.bookingData
      ? { ...aiResult.bookingData }
      : null;

    if (!currentState) {
      currentState = {
        clientName: null,
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };
    }

    // Robust Regex-based Fallback Extraction when AI returns empty/null fields but userMessage contains booking info
    const isUnset = (val: string | null | undefined) => !val || val === "null" || val === "غير محدد" || val === "";

    let extractedName = !isUnset(aiResult.bookingData?.clientName) ? aiResult.bookingData!.clientName : currentState.clientName;
    let extractedPhone = !isUnset(aiResult.bookingData?.clientPhone) ? aiResult.bookingData!.clientPhone : currentState.clientPhone;
    let extractedService = !isUnset(aiResult.bookingData?.serviceName) ? aiResult.bookingData!.serviceName : currentState.serviceName;
    let extractedDoctor = !isUnset(aiResult.bookingData?.doctorName) ? aiResult.bookingData!.doctorName : currentState.doctorName;
    let extractedBranch = !isUnset(aiResult.bookingData?.branchName) ? aiResult.bookingData!.branchName : currentState.branchName;
    let extractedTime = !isUnset(aiResult.bookingData?.timeSlot) ? aiResult.bookingData!.timeSlot : currentState.timeSlot;

    if (!extractedName || extractedName === "null") {
      const nameMatch = userMessage.match(/باسم\s+([^\s]+)/) || userMessage.match(/الاسم\s+([^\s]+)/);
      if (nameMatch) extractedName = nameMatch[1].trim();
    }
    if (!extractedPhone || extractedPhone === "null") {
      const phoneMatch = userMessage.match(/(?:التواصل|رقم|جوال|هاتف|رقمي)\s*[:]?\s*([+]?[0-9\s-]{9,15})/i) || userMessage.match(/(?<!\d)(?:0)?5\d{8}(?!\d)/);
      if (phoneMatch) extractedPhone = phoneMatch[1].replace(/[\s-]/g, "");
    }
    if (!extractedService) {
      const foundService = normalizeToOfficial(userMessage, clinic.services.map(s => s.name));
      if (foundService) extractedService = foundService;
    }
    if (!extractedDoctor) {
      const foundDoctor = normalizeToOfficial(userMessage, clinic.doctors.map(d => d.name));
      if (foundDoctor) extractedDoctor = foundDoctor;
    }
    if (!extractedBranch) {
      // Use fuzzy normalizeToOfficial so "الصحافة" matches "فرع الصحافة"
      const foundBranch = normalizeToOfficial(userMessage, clinic.branches.map(b => b.name));
      if (foundBranch) extractedBranch = foundBranch;
    }

    // Check if extractedTime is valid. If it's missing or fails normalization, try fallback.
    const { TimeNormalizer } = await import("./TimeNormalizer");
    if (!extractedTime || !TimeNormalizer.normalize(extractedTime)) {
      // Try to extract time from userMessage directly as a fallback
      const normalizedFromMessage = TimeNormalizer.normalize(userMessage);
      if (normalizedFromMessage) extractedTime = normalizedFromMessage;
    }

    const sanitizedData: ExtractedBookingData = {
      clientName: extractedName,
      clientPhone: extractedPhone,
      serviceName: extractedService,
      doctorName: extractedDoctor,
      branchName: extractedBranch,
      timeSlot: extractedTime,
    };

    // ── INSTRUMENTATION: Stage 1 — Post-Extraction ─────────────────────────
    console.log(JSON.stringify({
      stage: "ENTITY_EXTRACTION",
      source: "AI+Regex",
      extracted: {
        name: extractedName,
        phone: extractedPhone,
        service: extractedService,
        doctor: extractedDoctor,
        branch: extractedBranch,
        timeSlot: extractedTime,
      },
      aiRaw: {
        name: aiResult.bookingData?.clientName,
        branch: aiResult.bookingData?.branchName,
        timeSlot: aiResult.bookingData?.timeSlot,
      },
      currentState: {
        branch: currentState.branchName,
        timeSlot: currentState.timeSlot,
      }
    }));
    // ─────────────────────────────────────────────────────────────────────────

    if (modifiedBookingData) {
      modifiedBookingData.clientName = extractedName;
      modifiedBookingData.clientPhone = extractedPhone;
      modifiedBookingData.serviceName = extractedService;
      modifiedBookingData.doctorName = extractedDoctor;
      modifiedBookingData.branchName = extractedBranch;
      modifiedBookingData.timeSlot = extractedTime;
    }

    const isNewBookingRequest = userMessage.match(/حجز|أحجز|حابة أحجز|ابغى احجز|أبي أحجز|أبغى أحجز/i) && !userMessage.match(/تعديل|تغيير|تغير/i);
    let resolvedIntent = aiResult.intent;
    if (isNewBookingRequest && userMessage.match(/التواصل|رقم|جوال/i) && userMessage.match(/(?:05|966)\d{7,10}/)) {
      resolvedIntent = "BookAppointment";
    }
    
    if (resolvedIntent === "Unknown" || resolvedIntent === "unknown" || !resolvedIntent) {
      if (isNewBookingRequest) {
        resolvedIntent = "BookAppointment";
      } else {
        resolvedIntent = "Inquiry";
      }
    }

    // ── BOOKING CONTEXT ESCALATION ────────────────────────────────────────────
    // If user is already mid-booking (has service/doctor/branch in state) and
    // sends a short time expression like "طيب لو 10 ص" or "لو 3 مساء",
    // escalate Inquiry → BookAppointment (they're updating the time slot).
    const isInBookingContext = !!(currentState.serviceName || currentState.doctorName || currentState.branchName);
    const isShortTimeUpdate = userMessage.length < 40 && !!(extractedTime) && !userMessage.match(/حجز|إلغاء|تعديل|شكوى|مشكلة/i);
    if (resolvedIntent === "Inquiry" && isInBookingContext && isShortTimeUpdate) {
      console.log(`[IntentEscalation] Upgrading Inquiry → BookAppointment (booking context + time update: "${userMessage}")`);
      resolvedIntent = "BookAppointment";
    }
    // ─────────────────────────────────────────────────────────────────────────


    if (resolvedIntent === "BookAppointment" || resolvedIntent === "ModifyBooking") {
      const branchNames = clinic.branches.map((b) => b.name);
      const serviceNames = clinic.services.map((s) => s.name);
      const doctorNames = clinic.doctors.map((d) => d.name);

      // Controlled Merge Guard using normalizeToOfficial
      if (sanitizedData.branchName !== currentState.branchName) {
        const hasMention = normalizeToOfficial(userMessage, branchNames) !== null;
        if (!hasMention) {
          sanitizedData.branchName = currentState.branchName || null;
          if (modifiedBookingData) modifiedBookingData.branchName = currentState.branchName || null;
        }
      }

      if (sanitizedData.serviceName !== currentState.serviceName) {
        const hasMention = normalizeToOfficial(userMessage, serviceNames) !== null;
        if (!hasMention) {
          sanitizedData.serviceName = currentState.serviceName || null;
          if (modifiedBookingData) modifiedBookingData.serviceName = currentState.serviceName || null;
        }
      }

      if (sanitizedData.doctorName !== currentState.doctorName) {
        const hasMention = normalizeToOfficial(userMessage, doctorNames) !== null;
        if (!hasMention) {
          sanitizedData.doctorName = currentState.doctorName || null;
          if (modifiedBookingData) modifiedBookingData.doctorName = currentState.doctorName || null;
        }
      }

      // ── INSTRUMENTATION: Stage 2 — Pre-Validation (after Merge Guard) ────
      console.log(JSON.stringify({
        stage: "PRE_VALIDATION",
        finalSanitized: {
          name: sanitizedData.clientName,
          phone: sanitizedData.clientPhone,
          service: sanitizedData.serviceName,
          doctor: sanitizedData.doctorName,
          branch: sanitizedData.branchName,
          timeSlot: sanitizedData.timeSlot,
        },
        intent: resolvedIntent,
        userMessage,
      }));
      // ─────────────────────────────────────────────────────────────────────

      // Execute Central Validation Gate
      const validation = validateBookingData(sanitizedData, clientPhone, clinic);

      console.log(JSON.stringify({
        stage: "VALIDATION_RESULT",
        isValid: validation.isValid,
        missingFields: validation.missingFields,
        phoneRestricted: validation.phoneRestricted,
        normalizedPhone: validation.normalizedPhone,
        normalizedBranch: validation.normalizedBranch,
        normalizedService: validation.normalizedService,
        cleanTimeSlot: validation.cleanTimeSlot,
      }));
      console.log(`[ValidationGate] Missing: ${validation.missingFields.join(", ")}`);
      console.log(`[ValidationGate] CleanName: '${validation.cleanName}'`);

      if (validation.isValid) {
        const finalPhone = validation.normalizedPhone!;
        const isModification = resolvedIntent === "ModifyBooking" || userMessage.match(/تغيير|تعديل|أغير|أعدل|خليه|بدل|غيرت/i);
        let activeBooking = null;

        // -- DOUBLE BOOKING GUARD START --
        const { BookingService } = await import("./BookingService");
        const availableSlots = await BookingService.getAvailableSlots(clinic.id, validation.normalizedDoctor!);
        let slotIsAvailable = false;
        
        for (const slots of Object.values(availableSlots)) {
          if (slots.includes(validation.cleanTimeSlot!)) {
            slotIsAvailable = true;
            break;
          }
        }
        
        if (!slotIsAvailable) {
          finalResponse = `عذراً، الوقت الذي اخترته (${validation.cleanTimeSlot}) لم يعد متاحاً. أرجو اختيار وقت آخر من الأوقات المتاحة. 🌷`;
          if (modifiedBookingData) {
            modifiedBookingData.timeSlot = null;
          }
          bookingCreated = false;
          bookingModified = false;
          return { finalResponse, bookingCreated, bookingModified, modifiedBookingData, resolvedIntent };
        }
        // -- DOUBLE BOOKING GUARD END --

        if (isModification) {
          activeBooking = await prisma.booking.findFirst({
            where: {
              clinicId: clinic.id,
              clientPhone: finalPhone,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            orderBy: { createdAt: "desc" },
          });
        }

        if (activeBooking) {
          await prisma.booking.update({
            where: { id: activeBooking.id },
            data: {
              serviceName: validation.normalizedService!,
              doctorName: validation.normalizedDoctor!,
              branchName: validation.normalizedBranch!,
              timeSlot: validation.cleanTimeSlot!,
            },
          });
          bookingModified = true;
          finalResponse = `وصلني تعديل الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${validation.normalizedDoctor}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم تحديث موعدك، وسيتواصل معك موظف الاستقبال للتأكيد النهائي. 🌸`;
        } else {
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
            try {
              await prisma.$transaction(async (tx) => {
                const conflict = await tx.booking.findFirst({
                  where: {
                    clinicId: clinic.id,
                    doctorName: validation.normalizedDoctor!,
                    timeSlot: validation.cleanTimeSlot!,
                    status: { in: ["PENDING", "CONFIRMED"] }
                  }
                });
                
                if (conflict) {
                  throw new Error("DOUBLE_BOOKING");
                }

                await tx.booking.create({
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
              }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable
              });
              
              bookingCreated = true;

              const defaultCountry = clinic.countryCode || "SA";
              const userPhoneNormalized = extractSaudiPhone(clientPhone, defaultCountry);
              const isContactPhoneDifferent = finalPhone !== userPhoneNormalized && finalPhone !== clientPhone;

              let contactNote = "";
              const isForOther = userMessage.match(/زوجتي|والدتي|أمي|اختي|أختي|بنتي|ابنتي|صديقتي|ابني|ولدي/i);

              if (isForOther && !isContactPhoneDifferent) {
                const relation = userMessage.match(/زوجتي/i) ? "زوجتك" :
                                userMessage.match(/والدتي|أمي/i) ? "والدتك" :
                                userMessage.match(/اختي|أختي/i) ? "أختك" :
                                userMessage.match(/بنتي|ابنتي/i) ? "ابنتك" :
                                userMessage.match(/صديقتي/i) ? "صديقتك" : "الشخص المعني";
                contactNote = `\n\nسأتواصل مع ${relation} على نفس رقم الواتساب الحالي، وإذا كنت تفضل رقماً آخر للتواصل، أرجو تزويدي به 🌷`;
              }

              finalResponse = `وصلني طلب الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${validation.normalizedDoctor}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر. 🌸${contactNote}`;
            } catch (err: any) {
              if (err.message === "DOUBLE_BOOKING" || err.code === "P2034") {
                finalResponse = `عذراً، الوقت الذي اخترته (${validation.cleanTimeSlot}) تم حجزه للتو من قبل مراجع آخر. أرجو اختيار وقت آخر من الأوقات المتاحة. 🌷`;
                if (modifiedBookingData) {
                  modifiedBookingData.timeSlot = null;
                }
                bookingCreated = false;
                bookingModified = false;
                return { finalResponse, bookingCreated, bookingModified, modifiedBookingData, resolvedIntent };
              }
              throw err;
            }
          } else {
            finalResponse = `لدينا طلب حجز مُسجّل مسبقاً بنفس التفاصيل يا ${validation.cleanName} 🌷 تم إرسال طلبك بالفعل للاستقبال. إذا أردت إنشاء طلب جديد أو تعديل الحجز، أخبرني وسأبدأ معك طلبًا جديدًا.`;
          }
        }
      } else {
        // HARD GATE BLOCKED BOOKING
        const isHallucinatedSuccess = finalResponse.match(/تم|نجاح|ارسال|رفع|وصلني|حجز/i);

        if (sanitizedData.clientPhone && !validation.normalizedPhone && !validation.phoneRestricted) {
          finalResponse = "رقم الجوال يبدو غير صحيح. أرجو تزويدنا برقم تواصل صحيح بالصيغة الدولية أو المحلية 🌷";
        } else if (isHallucinatedSuccess || validation.missingFields.length > 0) {
          finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${validation.missingFields.join(" و ")} 🌷`;
        }

        if (modifiedBookingData) {
          if (validation.missingFields.includes("الاسم")) modifiedBookingData.clientName = null;
          if (validation.missingFields.includes("رقم الجوال الصحيح") || validation.phoneRestricted) modifiedBookingData.clientPhone = null;
          if (validation.missingFields.includes("الخدمة المطلوبة")) modifiedBookingData.serviceName = null;
          if (validation.missingFields.includes("الفرع المفضل")) modifiedBookingData.branchName = null;
          if (validation.missingFields.includes("الوقت المناسب")) modifiedBookingData.timeSlot = null;
        }
      }
    } else if (resolvedIntent === "CancelAppointment") {
      const defaultCountry = clinic.countryCode || "SA";
      const extractedPhone = extractSaudiPhone(clientPhone, defaultCountry);
      const finalPhone = extractedPhone || clientPhone;

      const activeBooking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: finalPhone,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeBooking) {
        await prisma.booking.update({
          where: { id: activeBooking.id },
          data: { status: "CANCELLED" },
        });
        bookingModified = true;
        finalResponse = `تم إلغاء حجزك بنجاح يا ${activeBooking.clientName} 🌷 تم إخطار الاستقبال بالإلغاء.`;
      } else {
        const hasDraft = currentState && (currentState.serviceName || currentState.branchName || currentState.timeSlot || currentState.clientName);
        if (hasDraft) {
          bookingModified = true;
          finalResponse = "تم إلغاء طلب الحجز وإعادة تعيين الجلسة بنجاح 🌷 إذا كنت ترغب في البدء من جديد، أنا هنا لمساعدتك.";
        } else {
          finalResponse = "لا يوجد لديك حجز نشط حالياً لإلغائه 🌷 إذا كنت ترغب في حجز موعد جديد، أنا هنا لمساعدتك.";
        }
      }
    } else if (resolvedIntent === "Inquiry") {
      // ── ROUTING GUARD: Availability questions → BookingService, NOT RAGPipeline ──
      const isAvailabilityQuery = userMessage.match(
        /فاضية?|متاح|أوقات|مواعيد|جدول|متى|ايمتى|إيمتى|امتى|وقت|ساعة/i
      ) && userMessage.match(/دكتور|د.|طبيبة?|موعد|حجز/i);

      if (isAvailabilityQuery && currentState.doctorName) {
        // Route to BookingService instead of RAGPipeline
        const { BookingService } = await import("./BookingService");
        const slotsData = await BookingService.getAvailableSlots(clinic.id, currentState.doctorName as string);
        if (Object.keys(slotsData).length === 0) {
          finalResponse = `لا توجد أوقات متاحة حالياً مع ${currentState.doctorName} في الأيام السبعة القادمة. هل تودين اختيار تاريخ آخر؟ 🌷`;
        } else {
          const lines = Object.entries(slotsData).map(([day, times]) =>
            `‫${day}: ${(times as string[]).join(" - ")}‪`
          );
          finalResponse = `الأوقات المتاحة مع ${currentState.doctorName} خلال الأيام السبعة القادمة 🌷:\n\n${lines.join("\n")}\n\nأي وقت يناسبكِ؟`;
        }
      } else if (aiResult.requiresRag) {
        try {
          const { RAGPipeline } = await import("./RAGPipeline");
          const chunks = await RAGPipeline.retrieve(clinic.id, userMessage, 3);
          finalResponse = await RAGPipeline.generateGroundedResponse(clinic, userMessage, chunks);
        } catch (ragError: unknown) {
          // RAG failure → graceful fallback, do NOT trigger humanTakeover
          console.error("[RAGPipeline] Failed, falling back to AI response:", ragError);
          // aiResult.response when requiresRag=true is a bridge message ("سأبحث...") not the real answer
          // Check if it's a meaningful response (>20 chars and not a placeholder)
          const isPlaceholder = !aiResult.response
            || aiResult.response.length < 20
            || aiResult.response.includes("سأبحث")
            || aiResult.response.includes("انتظر")
            || aiResult.response.includes("دعني");
          finalResponse = isPlaceholder
            ? "عذراً، لم أتمكن من جلب المعلومات التفصيلية حالياً. يمكنكِ التواصل مباشرة مع الاستقبال للحصول على إجابة دقيقة، أو اسأليني عن شيء آخر وسأكون سعيدة بمساعدتكِ! 🌷"
            : aiResult.response;
        }
      } else {
        finalResponse = aiResult.response;
      }
    } else if (resolvedIntent === "HumanTakeover" || resolvedIntent === "Complaint") {
      const reason = resolvedIntent === "Complaint" ? "شكوى أو اعتراض من العميل" : "طلب تصعيد للموظف البشري";
      Logger.info(`[HumanTakeoverTriggered] Action required. Reason: ${reason}`, { clinicId: clinic.id, clientPhone, requestId: "unknown" });
      finalResponse = "تم إيقاف الرد الآلي وتحويل محادثتك لموظف الاستقبال البشري فوراً لمساعدتك. سيقوم بالتواصل معك في أقرب وقت. 👩‍💻";
      bookingCreated = false;
      bookingModified = false;
      aiResult.humanTakeover = true; // Ensure flag is set for backend
      modifiedBookingData = {
        clientName: null,
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };
    }

    if (finalResponse) {
      finalResponse = finalResponse.replace(/\s*E2E\s*/gi, " ");
      finalResponse = finalResponse.replace(/\s*التجريبي\s*/g, " ");
      finalResponse = finalResponse.replace(/\s+/g, " ").trim();
    }

    return { finalResponse, bookingCreated, bookingModified, modifiedBookingData, resolvedIntent };
  }
}
