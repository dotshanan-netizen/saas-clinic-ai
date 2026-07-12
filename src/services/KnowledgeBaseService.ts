import { IKnowledgeBaseRepository } from "@/repositories/interfaces/IKnowledgeBaseRepository";
import { UpsertKbDto } from "@/dtos";
import { DomainEventBus, KnowledgeBaseUpdatedEvent } from "@/lib/events";
import { KnowledgeBase } from "@/generated/prisma";

export class KnowledgeBaseService {
  constructor(private kbRepository: IKnowledgeBaseRepository) {}

  async getKBItems(clinicSlug: string): Promise<KnowledgeBase[]> {
    return this.kbRepository.findAllByClinicSlug(clinicSlug);
  }

  async getKBItem(id: string): Promise<KnowledgeBase | null> {
    return this.kbRepository.findById(id);
  }

  async upsertKBItem(dto: UpsertKbDto): Promise<KnowledgeBase> {
    let kb: KnowledgeBase;

    if (dto.id) {
      kb = await this.kbRepository.update(dto.id, {
        category: dto.category,
        content: dto.content,
      });

      DomainEventBus.publish(
        new KnowledgeBaseUpdatedEvent(kb.clinicId, kb.category, "update")
      );
    } else {
      kb = await this.kbRepository.create(dto.clinicSlug, {
        category: dto.category,
        content: dto.content,
      });

      DomainEventBus.publish(
        new KnowledgeBaseUpdatedEvent(kb.clinicId, kb.category, "create")
      );
    }

    return kb;
  }

  async deleteKBItem(id: string): Promise<KnowledgeBase> {
    const kb = await this.kbRepository.delete(id);
    DomainEventBus.publish(
      new KnowledgeBaseUpdatedEvent(kb.clinicId, kb.category, "delete")
    );
    return kb;
  }
}
export default KnowledgeBaseService;
