import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  Prisma,
  WhatsappConversationDirection,
  WhatsappDeliveryStatus,
} from '@prisma/client';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import { Message, Metadata, Status } from './interfaces';

export type InboundCorrelation = 'list_send' | 'tenant_lead' | 'unknown';

export type InboundHandleResult = {
  persisted: boolean;
  correlation: InboundCorrelation;
};

@Injectable()
export class WebhookPersistenceService {
  private readonly logger = new Logger(WebhookPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleInboundMessage(
    msg: Message,
    _metadata: Metadata,
  ): Promise<InboundHandleResult> {
    const phone = normalizeListPhone(msg.from);
    const body = msg.text?.body ?? msg.button?.text ?? null;
    const resolved = await this.resolveCorrelation(msg);

    if (resolved.tenantId == null) {
      this.logger.warn(
        `[handleInboundMessage] skipping persist: no tenant for wamid=${msg.id} from=${phone}`,
      );
      return { persisted: false, correlation: resolved.kind };
    }

    try {
      await this.prisma.whatsappConversationMessage.create({
        data: {
          wamid: msg.id,
          direction: WhatsappConversationDirection.IN,
          type: msg.type,
          body,
          raw: msg as unknown as Prisma.InputJsonValue,
          phone,
          tenantId: resolved.tenantId,
          listLeadId: resolved.listLeadId,
          listSendId: resolved.listSendId,
        },
      });
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

    return { persisted: true, correlation: resolved.kind };
  }

  async handleStatus(status: Status): Promise<void> {
    const deliveryStatus = this.toDeliveryStatus(status.status);
    if (!deliveryStatus) {
      this.logger.warn(
        `[handleStatus] unknown status=${status.status} wamid=${status.id}; skipping`,
      );
      return;
    }

    const send = await this.prisma.tenantListSend.findUnique({
      where: { wamid: status.id },
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
        listSendId: send?.id ?? null,
      },
    });

    if (!send) {
      return;
    }

    await this.prisma.tenantListSend.update({
      where: { id: send.id },
      data: { lastStatus: deliveryStatus },
    });

    if (deliveryStatus === WhatsappDeliveryStatus.failed) {
      await this.prisma.tenantListLead.update({
        where: { id: send.listLeadId },
        data: { sendLockCampaignId: null },
      });
    }
  }

  private async resolveCorrelation(msg: Message): Promise<{
    kind: InboundCorrelation;
    tenantId: number | null;
    listLeadId: number | null;
    listSendId: number | null;
  }> {
    const contextWamid = msg.context?.id;
    if (!contextWamid) {
      return {
        kind: 'unknown',
        tenantId: null,
        listLeadId: null,
        listSendId: null,
      };
    }

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
