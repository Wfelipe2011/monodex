export interface InboundMessagePayload {
  id: number;
  wamid: string;
  direction: 'IN';
  type: string;
  body?: string;
  phone: string;
  createdAt: string;
}

export interface InboxInboundEventDto {
  type: 'message.inbound';
  tenantId: number;
  listId: number;
  leadId: number;
  message: InboundMessagePayload;
}
