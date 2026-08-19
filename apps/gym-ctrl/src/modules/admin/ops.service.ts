import { Injectable, NotFoundException } from '@nestjs/common';
import { WhatsappDeliveryStatus } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { isDedicatedPlatformAccount } from '@core/shared/whatsapp-conversation';

export const HOME_SENDS_TIMEZONE = 'America/Sao_Paulo';

/** São Paulo is UTC-3 year-round (DST abolished). */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeSendBuckets = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  total: number;
};

export function saoPauloDayRange(now: Date): {
  yesterdayStart: Date;
  todayStart: Date;
  tomorrowStart: Date;
} {
  const spWall = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  const todayStartMs =
    Date.UTC(
      spWall.getUTCFullYear(),
      spWall.getUTCMonth(),
      spWall.getUTCDate(),
    ) + SAO_PAULO_OFFSET_MS;
  return {
    yesterdayStart: new Date(todayStartMs - DAY_MS),
    todayStart: new Date(todayStartMs),
    tomorrowStart: new Date(todayStartMs + DAY_MS),
  };
}

function emptySendBuckets(): HomeSendBuckets {
  return {
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0,
    total: 0,
  };
}

function addSendStatus(
  bucket: HomeSendBuckets,
  lastStatus: WhatsappDeliveryStatus | null,
) {
  bucket.total += 1;
  if (lastStatus == null) {
    bucket.pending += 1;
    return;
  }
  bucket[lastStatus] += 1;
}

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [totalTenants, activeTenants, outreachEnabledTenants, totalLeads] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { active: true } }),
        this.prisma.tenantOutreachConfig.count({ where: { enabled: true } }),
        this.prisma.lead.count({ where: { deletedAt: null } }),
      ]);

    return {
      totalTenants,
      activeTenants,
      outreachEnabledTenants,
      totalLeads,
    };
  }

  async leadsStats(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }

    const [contacted, replied, quoted, closed, deleted] = await Promise.all([
      this.prisma.tenantLead.count({ where: { tenantId, contacted: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, replied: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, quoted: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, closed: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, deleted: true } }),
    ]);

    return { contacted, replied, quoted, closed, deleted };
  }

  async home(tenantId: number, now = new Date()) {
    const cityFunnel = await this.leadsStats(tenantId);
    const { yesterdayStart, todayStart, tomorrowStart } = saoPauloDayRange(now);
    const windowOpenSince = new Date(now.getTime() - DAY_MS);

    const [
      coinSum,
      outreach,
      threadCount,
      openWindows,
      lastInbound,
      listSends,
      citySends,
    ] = await Promise.all([
      this.prisma.coin.aggregate({
        where: { tenantId },
        _sum: { balance: true },
      }),
      this.prisma.tenantOutreachConfig.findUnique({
        where: { tenantId },
        select: {
          enabled: true,
          whatsappAccount: { select: { isDefault: true } },
        },
      }),
      this.prisma.whatsappConversation.count({ where: { tenantId } }),
      this.prisma.whatsappConversation.count({
        where: { tenantId, lastInboundAt: { gte: windowOpenSince } },
      }),
      this.prisma.whatsappConversation.aggregate({
        where: { tenantId },
        _max: { lastInboundAt: true },
      }),
      this.prisma.tenantListSend.findMany({
        where: {
          campaign: { list: { tenantId } },
          sentAt: { gte: yesterdayStart, lt: tomorrowStart },
        },
        select: { lastStatus: true, sentAt: true },
      }),
      this.prisma.tenantLead.findMany({
        where: {
          tenantId,
          messageId: { not: null },
          createdAt: { gte: yesterdayStart, lt: tomorrowStart },
        },
        select: { lastStatus: true, createdAt: true },
      }),
    ]);

    const today = emptySendBuckets();
    const yesterday = emptySendBuckets();

    for (const row of listSends) {
      const bucket = row.sentAt >= todayStart ? today : yesterday;
      addSendStatus(bucket, row.lastStatus);
    }
    for (const row of citySends) {
      const bucket = row.createdAt >= todayStart ? today : yesterday;
      addSendStatus(bucket, row.lastStatus);
    }

    return {
      coins: { balance: coinSum._sum.balance ?? 0 },
      outreach: {
        enabled: outreach?.enabled ?? false,
        hasDedicatedNumber: outreach?.whatsappAccount
          ? isDedicatedPlatformAccount(outreach.whatsappAccount)
          : false,
        cityFunnel,
      },
      inbox: {
        threadCount,
        openWindows,
        lastInboundAt: lastInbound._max.lastInboundAt?.toISOString() ?? null,
      },
      sends: {
        timezone: HOME_SENDS_TIMEZONE,
        today,
        yesterday,
      },
    };
  }

  async leadsCount() {
    const count = await this.prisma.lead.count({
      where: { deletedAt: null },
    });
    return { count };
  }
}
