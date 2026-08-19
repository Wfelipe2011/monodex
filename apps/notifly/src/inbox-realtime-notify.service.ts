import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';

export interface InboundMessagePayload {
  id: number;
  wamid: string;
  direction: 'IN';
  type: string;
  body?: string;
  phone: string;
  createdAt: string;
}

export interface InboxInboundEventPayload {
  type: 'message.inbound';
  tenantId: number;
  conversationId: number;
  displayName: string;
  message: InboundMessagePayload;
}

@Injectable()
export class InboxRealtimeNotifyService {
  private readonly logger = new Logger(InboxRealtimeNotifyService.name);

  constructor(private readonly http: HttpService) {}

  async notifyInbound(payload: InboxInboundEventPayload): Promise<void> {
    const base = process.env.GYM_CTRL_BASE_URL;
    const secret = process.env.INTERNAL_WS_NOTIFY_SECRET;
    if (!base || !secret) {
      this.logger.warn(
        'GYM_CTRL_BASE_URL or INTERNAL_WS_NOTIFY_SECRET missing; skip notify',
      );
      return;
    }
    try {
      await this.http.axiosRef.post(
        `${base.replace(/\/$/, '')}/internal/inbox/realtime/notify`,
        payload,
        {
          headers: {
            'X-Internal-Secret': secret,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `inbox realtime notify failed (tenantId=${payload.tenantId}, conversationId=${payload.conversationId}): ${message}`,
      );
    }
  }
}
