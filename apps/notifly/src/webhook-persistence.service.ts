import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  Prisma,
  WhatsappConversationDirection,
  WhatsappDeliveryStatus,
} from '@prisma/client';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  isDedicatedPlatformAccount,
  matchContactProfileName,
} from '@core/shared/whatsapp-conversation';
import {
  isDedicatedBoundToTenant,
  upsertConversationThenMessage,
} from './conversation-thread';
import { Contact, Message, Metadata, Status } from './interfaces';

export type InboundCorrelation =
  | 'list_send'
  | 'tenant_lead'
  | 'dedicated_number'
  | 'unknown';

export type InboundHandleResult = {
  persisted: boolean;
  correlation: InboundCorrelation;
  tenantId?: number;
  listLeadId?: number | null;
  conversationId?: number;
  displayName?: string;
  messageId?: number;
  wamid?: string;
  type?: string;
  body?: string | null;
  phone?: string;
  createdAt?: Date;
};

@Injectable()
export class WebhookPersistenceService {
  private readonly logger = new Logger(WebhookPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleInboundMessage(
    msg: Message,
    metadata: Metadata,
    contacts?: Contact[],
  ): Promise<InboundHandleResult> {
    const phone = normalizeListPhone(msg.from);
    const body = msg.text?.body ?? msg.button?.text ?? null;
    const resolved = await this.resolveCorrelation(msg, metadata);

    if (resolved.tenantId == null) {
      this.logger.warn(
        `[handleInboundMessage] skipping persist: no tenant for wamid=${msg.id} from=${phone}`,
      );
      return { persisted: false, correlation: resolved.kind };
    }

    const phoneNumberId = metadata?.phone_number_id;
    const dedicated =
      phoneNumberId != null &&
      phoneNumberId !== '' &&
      (await isDedicatedBoundToTenant(this.prisma, resolved.tenantId, {
        phoneNumberId,
      }));

    if (!dedicated) {
      this.logger.warn(
        `[handleInboundMessage] skipping conversation persist: not dedicated for tenant=${resolved.tenantId} wamid=${msg.id}`,
      );
      return {
        persisted: false,
        correlation: resolved.kind,
        tenantId: resolved.tenantId,
        listLeadId: resolved.listLeadId,
      };
    }

    const profileName = matchContactProfileName(contacts, msg.from);

    try {
      const result = await this.prisma.$transaction((tx) =>
        upsertConversationThenMessage(tx, {
          tenantId: resolved.tenantId,
          phone,
          profileName,
          direction: WhatsappConversationDirection.IN,
          wamid: msg.id,
          type: msg.type,
          body,
          raw: msg as unknown as Prisma.InputJsonValue,
          listLeadId: resolved.listLeadId,
          listSendId: resolved.listSendId,
        }),
      );
      return {
        persisted: true,
        correlation: resolved.kind,
        tenantId: resolved.tenantId,
        listLeadId: resolved.listLeadId,
        conversationId: result.conversationId,
        displayName: result.displayName,
        messageId: result.message.id,
        wamid: result.message.wamid,
        type: result.message.type,
        body: result.message.body,
        phone: result.message.phone,
        createdAt: result.message.createdAt,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.debug(
          `[handleInboundMessage] duplicate wamid=${msg.id}; ignoring`,
        );
        return { persisted: false, correlation: resolved.kind };
      }
      throw e;
    }
  }

  async handleStatus(status: Status): Promise<void> {
    const deliveryStatus = this.toDeliveryStatus(status.status);
    if (!deliveryStatus) {
      this.logger.warn(
        `[handleStatus] unknown status=${status.status} wamid=${status.id}; skipping`,
      );
      return;
    }

    const listSend = await this.prisma.tenantListSend.findUnique({
      where: { wamid: status.id },
    });
    const tenantLead = await this.prisma.tenantLead.findUnique({
      where: { messageId: status.id },
    });

    const metaTimestamp = new Date(Number(status.timestamp) * 1000);
    const rawErrors = (status as unknown as Record<string, unknown>).errors;

    await this.prisma.whatsappSendStatus.create({
      data: {
        wamid: status.id,
        status: deliveryStatus,
        metaTimestamp,
        recipientId: status.recipient_id,
        errors:
          rawErrors != null
            ? (rawErrors as Prisma.InputJsonValue)
            : undefined,
        listSendId: listSend?.id ?? null,
        tenantLeadId: tenantLead?.id ?? null,
      },
    });

    if (listSend) {
      await this.prisma.tenantListSend.update({
        where: { id: listSend.id },
        data: { lastStatus: deliveryStatus },
      });

      if (deliveryStatus === WhatsappDeliveryStatus.failed) {
        await this.prisma.tenantListLead.update({
          where: { id: listSend.listLeadId },
          data: { sendLockCampaignId: null },
        });
      }
    }

    if (tenantLead) {
      await this.prisma.tenantLead.update({
        where: { id: tenantLead.id },
        data: { lastStatus: deliveryStatus },
      });
    }
  }

  private async resolveCorrelation(
    msg: Message,
    metadata: Metadata,
  ): Promise<{
    kind: InboundCorrelation;
    tenantId: number | null;
    listLeadId: number | null;
    listSendId: number | null;
  }> {
    const contextWamid = msg.context?.id;
    if (contextWamid) {
      const send = await this.prisma.tenantListSend.findUnique({
        where: { wamid: contextWamid },
        include: {
          listLead: { include: { list: true } },
        },
      });
      if (send) {
        return {
          kind: 'list_send',
          tenantId: send.listLead.list.tenantId,
          listLeadId: send.listLeadId,
          listSendId: send.id,
        };
      }

      const tenantLead = await this.prisma.tenantLead.findFirst({
        where: { messageId: contextWamid },
        select: { tenantId: true },
      });
      if (tenantLead) {
        return {
          kind: 'tenant_lead',
          tenantId: tenantLead.tenantId,
          listLeadId: null,
          listSendId: null,
        };
      }
    }

    const phoneNumberId = metadata?.phone_number_id;
    if (phoneNumberId) {
      const account = await this.prisma.whatsappAccount.findFirst({
        where: { phoneNumberId },
      });
      if (account && isDedicatedPlatformAccount(account)) {
        const config = await this.prisma.tenantOutreachConfig.findUnique({
          where: { whatsappAccountId: account.id },
        });
        if (config) {
          return {
            kind: 'dedicated_number',
            tenantId: config.tenantId,
            listLeadId: null,
            listSendId: null,
          };
        }
      }
    }

    return {
      kind: 'unknown',
      tenantId: null,
      listLeadId: null,
      listSendId: null,
    };
  }

  private toDeliveryStatus(raw: string): WhatsappDeliveryStatus | null {
    if (
      raw === WhatsappDeliveryStatus.sent ||
      raw === WhatsappDeliveryStatus.delivered ||
      raw === WhatsappDeliveryStatus.read ||
      raw === WhatsappDeliveryStatus.failed
    ) {
      return raw;
    }
    return null;
  }
}
