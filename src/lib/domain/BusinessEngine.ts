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

  // Title-stripping fuzzy match (e.g., "دكتورة سحر" vs "د. سحر")
  const stripTitles = (str: string) => str.replace(/^(دكتورة|دكتور|د\.|د|أخصائية|الأخصائية|اخصائية)\s+/i, "").trim().toLowerCase();
  const cleanStripped = stripTitles(clean);
  if (cleanStripped) {
    const titleMatch = officialList.find((o) => stripTitles(o) === cleanStripped || stripTitles(o).includes(cleanStripped) || cleanStripped.includes(stripTitles(o)));
    if (titleMatch) return titleMatch;
  }

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
    // 🚧 TIME_TRACE (Phase A)
    console.log(`[TIME_TRACE] BusinessEngine.extract: aiTime="${aiResult.bookingData?.timeSlot}" currentStateTime="${currentState.timeSlot}" extractedTime="${extractedTime}"`);

    // ── ACTIVE BOOKING SESSION DETECTION ───────────────────────────────────────
    // If the AI returned NO booking intent AND NO booking-specific extracted data,
    // this message is NOT a continuation of an active booking flow.
    // Reset booking-specific fields to null to prevent stale state leakage.
    // Name and phone are customer identity — they persist across conversations.
    // This preserves booking continuation when the AI explicitly identifies it,
    // while preventing greetings/unrelated messages from inheriting stale state.
    const aiBookingIntent = aiResult.intent === "BookAppointment" || aiResult.intent === "ModifyBooking";
    const aiExtractedBookingField = aiResult.bookingData && (
      !isUnset(aiResult.bookingData.serviceName) ||
      !isUnset(aiResult.bookingData.doctorName) ||
      !isUnset(aiResult.bookingData.branchName) ||
      !isUnset(aiResult.bookingData.timeSlot)
    );
    if (!aiBookingIntent && !aiExtractedBookingField) {
      extractedService = null;
      extractedDoctor = null;
      extractedBranch = null;
      extractedTime = null;
    }
    // ───────────────────────────────────────────────────────────────────────────

    if (!extractedName || extractedName === "null") {
      const nameMatch = userMessage.match(/(?:اسمي|إسمي|أنا|انا|باسم|الاسم)\s+([^\s,.،]+)/i);
      if (nameMatch) extractedName = nameMatch[1].trim();
    }
    // PF-001 Fix: WhatsApp sender phone auto-injection per RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE
    if (!extractedPhone || extractedPhone === "null" || isUnset(extractedPhone)) {
      if (clientPhone) {
        extractedPhone = clientPhone;
      }
    }

    if (!extractedService) {
      const foundService = normalizeToOfficial(userMessage, clinic.services.map(s => s.name));
      if (foundService) extractedService = foundService;
    }

    if (extractedDoctor) {
      const normalizedDoc = normalizeToOfficial(extractedDoctor, clinic.doctors.map(d => d.name));
      if (normalizedDoc) extractedDoctor = normalizedDoc;
    } else {
      const foundDoctor = normalizeToOfficial(userMessage, clinic.doctors.map(d => d.name));
      if (foundDoctor) extractedDoctor = foundDoctor;
    }
    if (!extractedBranch) {
      // Use fuzzy normalizeToOfficial so "الصحافة" matches "فرع الصحافة"
      const foundBranch = normalizeToOfficial(userMessage, clinic.branches.map(b => b.name));
      if (foundBranch) extractedBranch = foundBranch;
    }

    // Prevent Double Normalization: Only parse time if extractedTime is not set yet.
    if (!extractedTime || isUnset(extractedTime)) {
      const { TimeNormalizer } = await import("./TimeNormalizer");
      const normalizedFromMessage = TimeNormalizer.normalize(userMessage);
      if (normalizedFromMessage) {
        extractedTime = normalizedFromMessage;
      }
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

    // PF-003 Fix: If a valid clinic service is identified in userMessage, upgrade intent to BookAppointment to break inquiry loop
    // ARCHITECTURAL RULE: Do NOT escalate Inquiry to BookAppointment if the AI has already
    // responded with specific availability information (contains time slot entries).
    // The AI's response content determines the nature of the inquiry, not user keywords.
    const aiProvidedAvailability = aiResult.response.match(/\d{1,2}:\d{2}\s+[صم]/);
    if (extractedService && (resolvedIntent === "Inquiry" || resolvedIntent === "GeneralQuestion" || resolvedIntent === "Other" || !resolvedIntent) && !aiProvidedAvailability) {
      resolvedIntent = "BookAppointment";
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
      // ARCHITECTURAL RULE: Only protect values that CURRENTLY EXIST in state.
      // When currentState is null (first extraction in a conversation), 
      // the AI extraction is trusted. The guard prevents the AI from 
      // OVERWRITING known values without user confirmation, but does NOT
      // block NEW extractions.
      if (currentState.branchName && sanitizedData.branchName !== currentState.branchName) {
        const hasMention = normalizeToOfficial(userMessage, branchNames) !== null;
        if (!hasMention) {
          sanitizedData.branchName = currentState.branchName || null;
          if (modifiedBookingData) modifiedBookingData.branchName = currentState.branchName || null;
        }
      }

      if (currentState.serviceName && sanitizedData.serviceName !== currentState.serviceName) {
        const hasMention = normalizeToOfficial(userMessage, serviceNames) !== null;
        if (!hasMention) {
          sanitizedData.serviceName = currentState.serviceName || null;
          if (modifiedBookingData) modifiedBookingData.serviceName = currentState.serviceName || null;
        }
      }

      if (currentState.doctorName && sanitizedData.doctorName !== currentState.doctorName) {
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
      const validation = validateBookingData(sanitizedData, clientPhone, clinic, currentState.timeSlot);

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
        const availableSlots = await BookingService.getAvailableSlots(clinic.id, validation.normalizedDoctor!, validation.normalizedService || undefined);
        const availableSlotKeys = Object.keys(availableSlots);
        const totalSlotCount = Object.values(availableSlots).reduce((sum, slots) => sum + slots.length, 0);
        console.log(JSON.stringify({
          event: "DOUBLE_BOOKING_GUARD_CHECK",
          searchTime: validation.cleanTimeSlot,
          availableDays: availableSlotKeys,
          totalAvailableSlots: totalSlotCount,
        }));
        let slotIsAvailable = false;
        
        // 🚧 TIME_TRACE (Phase A)
        console.log(`[TIME_TRACE] DoubleBookingGuard: cleanTimeSlot="${validation.cleanTimeSlot}" availableDays=${Object.keys(availableSlots).length}`);
        
        for (const slots of Object.values(availableSlots)) {
          for (const slot of slots) {
            const timeOnly = validation.cleanTimeSlot?.match(/\d{2}:\d{2}\s+[صم]/)?.[0];
            const hourNumMatch = validation.cleanTimeSlot?.match(/(\d{1,2})/);
            const userHour = hourNumMatch ? parseInt(hourNumMatch[1], 10) : null;

            const slotHourMatch = slot.match(/(\d{1,2}):\d{2}\s+([صم])/);
            const slotHour = slotHourMatch ? parseInt(slotHourMatch[1], 10) : null;

            const exactMatch = slot === validation.cleanTimeSlot;
            const endMatch = timeOnly && slot.endsWith(timeOnly);
            const includeMatch = validation.cleanTimeSlot && slot.includes(validation.cleanTimeSlot);
            const hourMatch = userHour !== null && slotHour !== null && userHour === slotHour;
            
            // 🚧 TIME_TRACE (Phase A)
            if (exactMatch || endMatch || includeMatch || hourMatch) {
              console.log(`[TIME_TRACE] SlotMatched: slot="${slot}" cleanTime="${validation.cleanTimeSlot}" timeOnly="${timeOnly}" userHour=${userHour} slotHour=${slotHour} exact=${exactMatch} end=${endMatch} include=${includeMatch} hour=${hourMatch}`);
              validation.cleanTimeSlot = slot;
              // ARCHITECTURAL RULE: Availability Check does NOT modify
              // Conversation Memory. modifiedBookingData is preserved
              // as last-turn AI extraction, not overwritten by calendar.
              console.log(JSON.stringify({
                event: "DOUBLE_BOOKING_GUARD_MATCH",
                slotMatched: slot,
                matchType: exactMatch ? "exact" : endMatch ? "end" : includeMatch ? "include" : "hour",
                requestedTime: timeOnly,
                userHour,
                slotHour,
              }));
              break;
            }
          }
          if (slotIsAvailable) break;
        }
        
        if (!slotIsAvailable) {
          // DISTINGUISH: "no slots generated at all" vs "slot not found in generated list"
          const isEmptySlots = totalSlotCount === 0;
          console.log(JSON.stringify({
            event: "DOUBLE_BOOKING_GUARD_NO_SLOT",
            failureMode: isEmptySlots ? "NO_SLOTS_AVAILABLE" : "SLOT_NOT_IN_GENERATED_LIST",
            searchedTime: validation.cleanTimeSlot,
            availableDays: availableSlotKeys,
            totalSlotsChecked: totalSlotCount,
            normalizedDoctor: validation.normalizedDoctor,
            normalizedService: validation.normalizedService,
            hint: isEmptySlots
              ? "getAvailableSlots returned ZERO slots. Check AVAILABLE_SLOTS_EMPTY event from BookingService for root cause (doctor not found, no schedules, or all closed)."
              : "Slots were generated but the requested time did not match any. The slot format may differ or the time may genuinely be outside working hours.",
          }));
          finalResponse = `عذراً، الوقت الذي اخترته (${validation.cleanTimeSlot}) لم يعد متاحاً. أرجو اختيار وقت آخر من الأوقات المتاحة. 🌷`;
          // Clear the unavailable timeSlot from state so the conversation
          // does NOT trap: on the next user message, currentState.timeSlot
          // will be null, allowing the system to prompt for a new time.
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

        let finalDoctorName = validation.normalizedDoctor!;
        if ((finalDoctorName === "أي طبيب" || finalDoctorName === "ANY") && validation.normalizedService) {
          const { BookingService } = await import("./BookingService");
          const doctorServices = await prisma.doctorService.findMany({
            where: {
              service: { clinicId: clinic.id, name: validation.normalizedService, status: "ACTIVE" },
              doctor: { status: "ACTIVE" }
            },
            include: { doctor: true }
          });
          const candidateDoctors = doctorServices.map((ds) => ds.doctor);
          for (const doc of candidateDoctors) {
            const docAvailableSlots = await BookingService.getAvailableSlots(clinic.id, doc.name);
            let hasSlot = false;
            for (const slots of Object.values(docAvailableSlots)) {
              if (slots.includes(validation.cleanTimeSlot!)) {
                hasSlot = true;
                break;
              }
            }
            if (hasSlot) {
              finalDoctorName = doc.name;
              break;
            }
          }
        }

        if (activeBooking) {
          await prisma.booking.update({
            where: { id: activeBooking.id },
            data: {
              serviceName: validation.normalizedService!,
              doctorName: finalDoctorName,
              branchName: validation.normalizedBranch!,
              timeSlot: validation.cleanTimeSlot!,
            },
          });
          bookingModified = true;
          finalResponse = `وصلني تعديل الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${finalDoctorName}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم تحديث موعدك، وسيتواصل معك موظف الاستقبال للتأكيد النهائي. 🌸`;
        } else {
          // Check for duplicates
          const existingBooking = await prisma.booking.findFirst({
            where: {
              clinicId: clinic.id,
              clientPhone: finalPhone,
              serviceName: validation.normalizedService!,
              doctorName: finalDoctorName,
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
                    doctorName: finalDoctorName,
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
                    doctorName: finalDoctorName,
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

              finalResponse = `وصلني طلب الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${finalDoctorName}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر. 🌸${contactNote}`;
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
          // Define priority order for prompting
          const order = ["الاسم", "رقم الجوال", "الخدمة المطلوبة", "الفرع المفضل", "الطبيب المفضل", "الوقت المناسب"];
          let nextField = "";
          for (const f of order) {
            const match = validation.missingFields.find(mf => mf.startsWith(f));
            if (match) {
              nextField = match;
              break;
            }
          }
          if (!nextField) {
            nextField = validation.missingFields[0];
          }

          if (nextField === "الاسم") {
            finalResponse = "تسعدنا خدمتكِ يا قلبي! 🌸 ممكن تفيديني باسمكِ الكريم للتسجيل؟";
          } else if (nextField === "رقم الجوال") {
            finalResponse = "يا هلا بكِ! 🌸 ممكن رقم الجوال للتواصل وتأكيد الحجز؟";
          } else if (nextField.startsWith("رقم جوال للتواصل من")) {
            finalResponse = `الرجاء تزويدنا برقم تواصل صحيح من إحدى الدول المدعومة 🌷`;
          } else if (nextField === "الخدمة المطلوبة") {
            finalResponse = "يا هلا بكِ في عيادة ريفال! 🌸 وش الخدمة أو الجلسة اللي حابة تحجزيها اليوم؟ (مثل البوتكس، الفيلر، تنظيف البشرة أو ليزر)";
          } else if (nextField === "الفرع المفضل") {
            finalResponse = "من عيوني! 🌸 في أي فرع تفضلين الحجز؟ عندنا فرع الصحافة وفرع التحلية بالرياض.";
          } else if (nextField === "الطبيب المفضل") {
            finalResponse = "أبشري من عيوني! 🌸 هل تفضلين طبيبة/أخصائية معينة للجلسة أم تبحثين عن أول موعد متاح مع أي طبيب؟";
          } else if (nextField === "الوقت المناسب") {
            finalResponse = "تمام يا قلبي! 🌸 تحبين موعدكِ يكون في أي يوم؟ وأي وقت يناسبكِ (صباحي أم مسائي)؟";
          } else {
            finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${nextField} 🌷`;
          }
        }

        // Validation result is used for response generation only.
        // ARCHITECTURAL RULE: Validation does NOT modify Conversation Memory.
        // modifiedBookingData preserves whatever the AI extracted, even if
        // some fields fail canonical matching. This prevents state loss across
        // multi-turn booking flows when the user sends partial responses.
        // The missing fields are communicated to the user via finalResponse above.
        // Memory is only updated when the user explicitly provides new values
        // or when a booking is successfully created/confirmed.
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
          finalResponse = `لا توجد أوقات متاحة حالياً مع ${currentState.doctorName} خلال الـ 30 يوماً القادمة. هل تودين اختيار تاريخ آخر؟ 🌷`;
        } else {
          const lines = Object.entries(slotsData).map(([day, times]) => {
            const cleanTimes = (times as string[]).map(t => t.replace(day, "").trim());
            return `‫${day}: ${cleanTimes.join(" - ")}‪`;
          });
          finalResponse = `الأوقات المتاحة مع ${currentState.doctorName} 🌷:\n\n${lines.join("\n")}\n\nأي وقت يناسبكِ؟`;
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
