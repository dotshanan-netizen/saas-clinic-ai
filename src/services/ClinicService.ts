import { IClinicRepository } from "@/repositories/interfaces/IClinicRepository";
import { UpdateClinicConfigDto } from "@/dtos";
import { encrypt, decrypt } from "@/lib/encryption";
import { DomainEventBus, ClinicConfigUpdatedEvent } from "@/lib/events";
import { Clinic } from "@/generated/prisma";

export class ClinicService {
  constructor(private clinicRepository: IClinicRepository) {}

  async getClinicProfile(slug: string): Promise<Omit<Clinic, "whatsappToken" | "whatsappVerifyToken"> & { hasWhatsappToken: boolean }> {
    const clinic = await this.clinicRepository.findBySlug(slug);
    if (!clinic) {
      throw new Error(`Clinic not found with slug: ${slug}`);
    }
    return this.sanitizeClinic(clinic);
  }

  async updateClinicConfig(
    slug: string,
    dto: UpdateClinicConfigDto
  ): Promise<Omit<Clinic, "whatsappToken" | "whatsappVerifyToken"> & { hasWhatsappToken: boolean }> {
    const clinic = await this.clinicRepository.findBySlug(slug);
    if (!clinic) {
      throw new Error(`Clinic not found with slug: ${slug}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      name: dto.name,
      logoUrl: dto.logoUrl,
      description: dto.description,
      contactPhone: dto.contactPhone,
      operatingHours: dto.operatingHours,
      welcomeMessage: dto.welcomeMessage,
      customPrompt: dto.customPrompt,
      whatsappPhoneId: dto.whatsappPhoneId,
      whatsappWabaId: dto.whatsappWabaId,
      isAiActive: dto.isAiActive,
    };

    // If token is updated, encrypt it
    if (dto.whatsappToken) {
      const { encryptedData, iv, authTag } = encrypt(dto.whatsappToken);
      updateData.whatsappToken = `${iv}:${authTag}:${encryptedData}`;
    }

    if (dto.whatsappVerifyToken) {
      updateData.whatsappVerifyToken = dto.whatsappVerifyToken;
    }

    const updatedClinic = await this.clinicRepository.update(clinic.id, updateData);

    // Publish config update event
    DomainEventBus.publish(new ClinicConfigUpdatedEvent(clinic.id));

    return this.sanitizeClinic(updatedClinic);
  }

  /**
   * Internal helper to decrypt token for WhatsApp client API calls
   */
  async getDecryptedToken(id: string): Promise<string | null> {
    const clinic = await this.clinicRepository.findById(id);
    if (!clinic || !clinic.whatsappToken) return null;

    try {
      const parts = clinic.whatsappToken.split(":");
      if (parts.length !== 3) {
        // Fallback for non-encrypted token (migration legacy)
        return clinic.whatsappToken;
      }
      const [iv, authTag, encryptedData] = parts;
      return decrypt(encryptedData, iv, authTag);
    } catch (err) {
      console.error(`Error decrypting whatsappToken for clinic ${id}:`, err);
      return null;
    }
  }

  private sanitizeClinic(
    clinic: Clinic
  ): Omit<Clinic, "whatsappToken" | "whatsappVerifyToken"> & { hasWhatsappToken: boolean } {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { whatsappToken, whatsappVerifyToken, ...rest } = clinic;
    return {
      ...rest,
      hasWhatsappToken: !!whatsappToken,
    };
  }
}
export default ClinicService;
