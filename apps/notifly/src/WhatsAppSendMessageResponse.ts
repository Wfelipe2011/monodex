export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Contact[];
  messages: MessageStatus[];
}

export interface Contact {
  input: string;
  wa_id: string;
}

export interface MessageStatus {
  id: string;
  message_status: 'accepted' | 'queued' | 'failed';
}
