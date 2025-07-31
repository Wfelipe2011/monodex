export interface WhatsAppWebhook {
  object: 'whatsapp_business_account';
  entry: Entry[];
}

export interface Entry {
  id: string;
  changes: Change[];
}

export interface Change {
  field: 'messages';
  value: ChangeValue;
}

export interface ChangeValue {
  messaging_product: 'whatsapp';
  metadata: Metadata;
  contacts?: Contact[];
  messages?: Message[];
  statuses?: Status[];
}

export interface Metadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface Contact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export type MessageType = 'text' | 'button' | 'image' | 'document' | 'sticker' | 'video' | 'audio';

export interface Message {
  from: string;
  id: string;
  timestamp: string;
  type: MessageType;
  context?: {
    from: string;
    id: string;
  };
  text?: {
    body: string;
  };
  button?: {
    payload: string;
    text: string;
  };
}

export type StatusType = 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';

export interface Status {
  id: string;
  status: StatusType;
  timestamp: string;
  recipient_id: string;
  conversation: {
    id: string;
    expiration_timestamp?: string;
    origin: {
      type: 'marketing' | 'utility' | 'authentication';
    };
  };
  pricing: {
    billable: boolean;
    pricing_model: string;
    category: 'marketing' | 'utility' | 'authentication';
  };
}
