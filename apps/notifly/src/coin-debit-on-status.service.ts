import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  CoinDebitOnStatus,
  Prisma,
  WhatsappDeliveryStatus,
} from '@prisma/client';

const STATUS_RANK: Record<
  Exclude<WhatsappDeliveryStatus, 'failed'>,
  number
> = {
  sent: 1,
  delivered: 2,
  read: 3,
};

const TRIGGER_RANK: Record<CoinDebitOnStatus, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
};

export type ApplyAfterStatusArgs = {
  tenantId: number;
  status: WhatsappDeliveryStatus;
  tenantLeadId?: number | null;
  listSendId?: number | null;
};

@Injectable()
export class CoinDebitOnStatusService {
  private readonly logger = new Logger(CoinDebitOnStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aplica débito ou estorno idempotente após persistir o status.
   * Mutações de coin + timestamps rodam em `$transaction` isolada;
   * o caller deve preferir try/log para não reverter o append de WhatsappSendStatus.
   */
  async applyAfterStatus(args: ApplyAfterStatusArgs): Promise<void> {
    const { tenantId, status, tenantLeadId, listSendId } = args;

    if (tenantLeadId == null && listSendId == null) {
      return;
    }

    if (status === WhatsappDeliveryStatus.failed) {
      await this.refundIfNeeded({ tenantId, tenantLeadId, listSendId });
      return;
    }

    await this.debitIfDue({ tenantId, status, tenantLeadId, listSendId });
  }

  private async debitIfDue(args: {
    tenantId: number;
    status: WhatsappDeliveryStatus;
    tenantLeadId?: number | null;
    listSendId?: number | null;
  }): Promise<void> {
    const trigger = await this.resolveTrigger(args.tenantId);
    if (!this.meetsTrigger(args.status, trigger)) {
      return;
    }

    if (args.listSendId != null) {
      await this.debitListSend(args.tenantId, args.listSendId);
      return;
    }
    if (args.tenantLeadId != null) {
      await this.debitCityLead(args.tenantId, args.tenantLeadId);
    }
  }

  private async refundIfNeeded(args: {
    tenantId: number;
    tenantLeadId?: number | null;
    listSendId?: number | null;
  }): Promise<void> {
    if (args.listSendId != null) {
      await this.refundListSend(args.tenantId, args.listSendId);
      return;
    }
    if (args.tenantLeadId != null) {
      await this.refundCityLead(args.tenantId, args.tenantLeadId);
    }
  }

  private async debitCityLead(
    tenantId: number,
    tenantLeadId: number,
  ): Promise<void> {
    const lead = await this.prisma.tenantLead.findUnique({
      where: { id: tenantLeadId },
      select: {
        id: true,
        tenantId: true,
        leadId: true,
        messageId: true,
        coinDebitedAt: true,
      },
    });
    if (!lead || lead.tenantId !== tenantId || lead.coinDebitedAt != null) {
      return;
    }

    const cost = await this.resolveCityCost(tenantId);
    if (cost <= 0) {
      return;
    }

    const wamid = lead.messageId ?? 'unknown';
    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.tenantLead.findUnique({
        where: { id: tenantLeadId },
        select: { coinDebitedAt: true },
      });
      if (fresh?.coinDebitedAt != null) {
        return;
      }

      const userId = await this.resolveWalletUserId(tx, tenantId);
      if (userId == null) {
        this.logger.warn(
          `[debitCityLead] sem carteira/user para tenant=${tenantId} tenantLeadId=${tenantLeadId}`,
        );
        return;
      }

      await tx.coin.update({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        data: { balance: { decrement: cost } },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          tenantId,
          leadId: lead.leadId,
          type: 'DEBITO',
          amount: -cost,
          description: `city wamid=${wamid} tenantLeadId=${tenantLeadId}`,
        },
      });
      await tx.tenantLead.update({
        where: { id: tenantLeadId },
        data: { coinDebitedAt: new Date() },
      });
    });
  }

  private async debitListSend(
    tenantId: number,
    listSendId: number,
  ): Promise<void> {
    const send = await this.prisma.tenantListSend.findUnique({
      where: { id: listSendId },
      select: {
        id: true,
        wamid: true,
        coinDebitedAt: true,
        listLead: {
          select: {
            id: true,
            list: { select: { tenantId: true, costPerSend: true } },
          },
        },
      },
    });
    if (
      !send ||
      send.listLead.list.tenantId !== tenantId ||
      send.coinDebitedAt != null
    ) {
      return;
    }

    const cost = send.listLead.list.costPerSend;
    if (cost <= 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.tenantListSend.findUnique({
        where: { id: listSendId },
        select: { coinDebitedAt: true },
      });
      if (fresh?.coinDebitedAt != null) {
        return;
      }

      const userId = await this.resolveWalletUserId(tx, tenantId);
      if (userId == null) {
        this.logger.warn(
          `[debitListSend] sem carteira/user para tenant=${tenantId} listSendId=${listSendId}`,
        );
        return;
      }

      await tx.coin.update({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        data: { balance: { decrement: cost } },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          tenantId,
          type: 'DEBITO',
          amount: -cost,
          description: `list wamid=${send.wamid} listSendId=${listSendId}`,
        },
      });
      await tx.tenantListSend.update({
        where: { id: listSendId },
        data: { coinDebitedAt: new Date() },
      });
    });
  }

  private async refundCityLead(
    tenantId: number,
    tenantLeadId: number,
  ): Promise<void> {
    const lead = await this.prisma.tenantLead.findUnique({
      where: { id: tenantLeadId },
      select: {
        id: true,
        tenantId: true,
        leadId: true,
        messageId: true,
        coinDebitedAt: true,
        coinRefundedAt: true,
      },
    });
    if (
      !lead ||
      lead.tenantId !== tenantId ||
      lead.coinDebitedAt == null ||
      lead.coinRefundedAt != null
    ) {
      return;
    }

    const cost = await this.resolveCityCost(tenantId);
    if (cost <= 0) {
      return;
    }

    const wamid = lead.messageId ?? 'unknown';
    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.tenantLead.findUnique({
        where: { id: tenantLeadId },
        select: { coinDebitedAt: true, coinRefundedAt: true },
      });
      if (
        fresh?.coinDebitedAt == null ||
        fresh.coinRefundedAt != null
      ) {
        return;
      }

      const userId = await this.resolveWalletUserId(tx, tenantId);
      if (userId == null) {
        this.logger.warn(
          `[refundCityLead] sem carteira/user para tenant=${tenantId} tenantLeadId=${tenantLeadId}`,
        );
        return;
      }

      await tx.coin.update({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        data: { balance: { increment: cost } },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          tenantId,
          leadId: lead.leadId,
          type: 'CREDITO',
          amount: cost,
          description: `city refund wamid=${wamid} tenantLeadId=${tenantLeadId}`,
        },
      });
      await tx.tenantLead.update({
        where: { id: tenantLeadId },
        data: { coinRefundedAt: new Date() },
      });
    });
  }

  private async refundListSend(
    tenantId: number,
    listSendId: number,
  ): Promise<void> {
    const send = await this.prisma.tenantListSend.findUnique({
      where: { id: listSendId },
      select: {
        id: true,
        wamid: true,
        coinDebitedAt: true,
        coinRefundedAt: true,
        listLead: {
          select: {
            list: { select: { tenantId: true, costPerSend: true } },
          },
        },
      },
    });
    if (
      !send ||
      send.listLead.list.tenantId !== tenantId ||
      send.coinDebitedAt == null ||
      send.coinRefundedAt != null
    ) {
      return;
    }

    const cost = send.listLead.list.costPerSend;
    if (cost <= 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.tenantListSend.findUnique({
        where: { id: listSendId },
        select: { coinDebitedAt: true, coinRefundedAt: true },
      });
      if (
        fresh?.coinDebitedAt == null ||
        fresh.coinRefundedAt != null
      ) {
        return;
      }

      const userId = await this.resolveWalletUserId(tx, tenantId);
      if (userId == null) {
        this.logger.warn(
          `[refundListSend] sem carteira/user para tenant=${tenantId} listSendId=${listSendId}`,
        );
        return;
      }

      await tx.coin.update({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        data: { balance: { increment: cost } },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          tenantId,
          type: 'CREDITO',
          amount: cost,
          description: `list refund wamid=${send.wamid} listSendId=${listSendId}`,
        },
      });
      await tx.tenantListSend.update({
        where: { id: listSendId },
        data: { coinRefundedAt: new Date() },
      });
    });
  }

  private async resolveTrigger(
    tenantId: number,
  ): Promise<CoinDebitOnStatus> {
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: { coinDebitOnStatus: true },
    });
    return config?.coinDebitOnStatus ?? CoinDebitOnStatus.delivered;
  }

  private async resolveCityCost(tenantId: number): Promise<number> {
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: { costPerLead: true },
    });
    return config?.costPerLead ?? 0;
  }

  /**
   * Mesmo critério dos crons: `coin.findFirst({ tenantId }).userId`,
   * com fallback para o primeiro user do tenant (legado cidade).
   */
  private async resolveWalletUserId(
    tx: Prisma.TransactionClient,
    tenantId: number,
  ): Promise<number | null> {
    const coin = await tx.coin.findFirst({
      where: { tenantId },
      select: { userId: true },
    });
    if (coin?.userId != null) {
      return coin.userId;
    }
    const user = await tx.user.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private meetsTrigger(
    status: WhatsappDeliveryStatus,
    trigger: CoinDebitOnStatus,
  ): boolean {
    if (status === WhatsappDeliveryStatus.failed) {
      return false;
    }
    return STATUS_RANK[status] >= TRIGGER_RANK[trigger];
  }
}
