export interface IncomingMessagePayload {
  wamid: string;
  clinicId: string;
  clientPhone: string;
  messageText: string;
  source: string;
}

export interface IJobDispatcher {
  enqueueIncomingMessage(payload: IncomingMessagePayload): Promise<void>;
}
