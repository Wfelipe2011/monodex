import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Roles } from '@prisma/client';
import * as crypto from 'crypto';
import * as webpush from 'web-push';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  InboxInboundEventDto,
  InboundMessagePayload,
} from './inbox-inbound-event.interface';

const PREVIEW_MAX_LENGTH = 120;

export type WebPushPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
    tenantId: number;
    listId: number;
    leadId: number;
    messageId: number;
  };
};

export function formatPhone(raw: string): string {
  const digits = normalizeListPhone(raw);
  if (!digits) {
    return raw.trim() || 'Contato';
  }
  if (digits.length >= 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return `+${digits}`;
}

function truncatePreview(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '📎 Nova mensagem';
  }
  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

export function buildPreview(message: InboundMessagePayload): string {
  const type = message.type?.toLowerCase() ?? '';
  if (type === 'text' || type === 'button') {
    return truncatePreview(message.body ?? '');
  }
  return '📎 Nova mensagem';
}

export function buildPushPayload(dto: InboxInboundEventDto): WebPushPayload {
  const leadLabel = dto.leadName?.trim() || formatPhone(dto.message.phone);
  return {
    title: `Nova mensagem de ${leadLabel}`,
    body: buildPreview(dto.message),
    tag: `inbox-lead-${dto.leadId}`,
    data: {
      url: `/tenant/${dto.tenantId}/lead-lists/${dto.listId}/leads/${dto.leadId}`,
      tenantId: dto.tenantId,
      listId: dto.listId,
      leadId: dto.leadId,
      messageId: dto.message.id,
    },
  };
}

function vapidPublicKeyFromPrivate(privateKeyBase64Url: string): string {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(privateKeyBase64Url, 'base64url'));
  return ecdh.getPublicKey().subarray(1).toString('base64url');
}

@Injectable()
export class InboxWebPushService implements OnModuleInit {
  private readonly logger = new Logger(InboxWebPushService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const subject = this.config.get<string>('VAPID_SUBJECT');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!subject || !privateKey) {
      throw new Error('VAPID_SUBJECT and VAPID_PRIVATE_KEY are required');
    }

    const publicKey =
      this.config.get<string>('VAPID_PUBLIC_KEY') ??
      vapidPublicKeyFromPrivate(privateKey);

    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async sendForInbound(
    dto: InboxInboundEventDto,
    skipUserIds: Set<number>,
  ): Promise<void> {
    try {
      const payload = buildPushPayload(dto);
      const payloadJson = JSON.stringify(payload);

      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { tenantId: dto.tenantId },
            { roles: { has: Roles.SUPER_ADMIN } },
          ],
        },
        select: {
          id: true,
          pushSubscriptions: {
            select: {
              endpoint: true,
              p256dh: true,
              auth: true,
            },
          },
        },
      });

      for (const user of users) {
        if (skipUserIds.has(user.id)) {
          continue;
        }
        for (const sub of user.pushSubscriptions) {
          await this.sendToSubscription(sub, payloadJson);
        }
      }
    } catch (error) {
      this.logger.error(`sendForInbound failed: ${error}`);
    }
  }

  private async sendToSubscription(
    sub: { endpoint: string; p256dh: string; auth: string },
    payloadJson: string,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadJson,
      );
    } catch (error: unknown) {
      const statusCode =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof (error as { statusCode: unknown }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : undefined;

      if (statusCode === 410) {
        try {
          await this.prisma.pushSubscription.delete({
            where: { endpoint: sub.endpoint },
          });
          this.logger.debug(`Removed expired push subscription ${sub.endpoint}`);
        } catch (deleteError) {
          this.logger.warn(
            `Failed to delete expired subscription ${sub.endpoint}: ${deleteError}`,
          );
        }
        return;
      }

      this.logger.warn(
        `Push failed for ${sub.endpoint} (status=${statusCode ?? 'unknown'}): ${error}`,
      );
    }
  }
}
