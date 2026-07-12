export abstract class DomainEvent {
  abstract readonly name: string;
  readonly timestamp: Date = new Date();
}

export class ClinicCatalogUpdatedEvent extends DomainEvent {
  readonly name = "ClinicCatalogUpdatedEvent";
  constructor(
    public readonly clinicId: string,
    public readonly entityType: "service" | "doctor" | "branch",
    public readonly entityId: string,
    public readonly action: "create" | "update" | "delete"
  ) {
    super();
  }
}

export class ClinicConfigUpdatedEvent extends DomainEvent {
  readonly name = "ClinicConfigUpdatedEvent";
  constructor(
    public readonly clinicId: string
  ) {
    super();
  }
}

export class KnowledgeBaseUpdatedEvent extends DomainEvent {
  readonly name = "KnowledgeBaseUpdatedEvent";
  constructor(
    public readonly clinicId: string,
    public readonly category: "FAQ" | "POLICY" | "GENERAL_INFO",
    public readonly action: "create" | "update" | "delete"
  ) {
    super();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (event: any) => Promise<void> | void;

export class DomainEventBus {
  private static listeners: Map<string, EventCallback[]> = new Map();

  /**
   * Subscribe to a specific domain event
   */
  static subscribe(eventName: string, callback: EventCallback): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(callback);
  }

  /**
   * Publish an event to all subscribers asynchronously
   */
  static publish(event: DomainEvent): void {
    const callbacks = this.listeners.get(event.name) || [];
    for (const callback of callbacks) {
      // Execute each listener in the next tick of the event loop to avoid blocking
      Promise.resolve()
        .then(() => callback(event))
        .catch((err) => {
          console.error(`[DomainEventBus] Error handling event ${event.name}:`, err);
        });
    }
  }

  /**
   * Clears all listeners (useful for testing)
   */
  static clearAll(): void {
    this.listeners.clear();
  }
}
