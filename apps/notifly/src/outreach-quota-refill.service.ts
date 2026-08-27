import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  Lead,
  OutreachSendRun,
  OutreachSendRunChannel,
  OutreachSendRunClosedReason,
  OutreachSendRunStatus,
  Prisma,
  TenantListLead,
  WhatsappDeliveryStatus,
} from '@prisma/client';
import { computeAvailableBalance } from '@core/shared/on-demand-balance';
import {
  affordableFromAvailable,
  cityUsedPhonesWhere,
  loadCrossChannelPending,
} from './coin-reservation';
import {
  buildCategoryAverages,
  computeY,
  excludeUsedPhones,
  isPremium,
  selectStratifiedBatch,
  uniqueByPhone,
} from './premium-mix';
import { OutreachSendRunService } from './outreach-send-run.service';

export type CityRefillSender = (args: {
  runId: number;
  tenantId: number;
  lead: Lead;
}) => Promise<{ accepted: boolean; tenantLeadId?: number }>;

export type ListRefillSender = (args: {
  runId: number;
  tenantId: number;
  campaignId: number;
  listLead: TenantListLead;
}) => Promise<{ accepted: boolean; listSendId?: number }>;

export type RefillOneArgs = {
  runId: number;
  failedPhone?: string;
  wasPremium?: boolean;
  failedListLeadId?: number;
  sourceTenantLeadId?: number;
  sourceListSendId?: number;
  /** Override / test hook — evita DI circular com LeadsService. */
  sendCityLead?: CityRefillSender;
  /** Override / test hook — evita DI circular com ListCampaignsService. */
  sendListLead?: ListRefillSender;
};

@Injectable()
export class OutreachQuotaRefillService {
  private readonly logger = new Logger(OutreachQuotaRefillService.name);

  private citySender: CityRefillSender | null = null;
  private listSender: ListRefillSender | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runs: OutreachSendRunService,
  ) {}

  /** Tasks 03–04 registram senders finos sem circular DI. */
  registerCitySender(sender: CityRefillSender): void {
    this.citySender = sender;
  }

  registerListSender(sender: ListRefillSender): void {
    this.listSender = sender;
  }

  async refillOne(args: RefillOneArgs): Promise<void> {
    try {
      await this.refillOneInner(args);
    } catch (error) {
      this.logger.error(
        `[refillOne] run=${args.runId} erro: ${error}`,
      );
    }
  }

  private async refillOneInner(args: RefillOneArgs): Promise<void> {
    if (args.sourceTenantLeadId != null) {
      const claimed = await this.prisma.tenantLead.updateMany({
        where: {
          id: args.sourceTenantLeadId,
          refillTriggeredAt: null,
        },
        data: { refillTriggeredAt: new Date() },
      });
      if (claimed.count === 0) {
        this.logger.log(
          `[refillOne] idempotent skip tenantLead=${args.sourceTenantLeadId}`,
        );
        return;
      }
    }

    if (args.sourceListSendId != null) {
      const claimed = await this.prisma.tenantListSend.updateMany({
        where: {
          id: args.sourceListSendId,
          refillTriggeredAt: null,
        },
        data: { refillTriggeredAt: new Date() },
      });
      if (claimed.count === 0) {
        this.logger.log(
          `[refillOne] idempotent skip listSend=${args.sourceListSendId}`,
        );
        return;
      }
    }

    const runRow = await this.prisma.outreachSendRun.findUnique({
      where: { id: args.runId },
    });
    if (!runRow) {
      return;
    }

    const open = await this.runs.ensureOpen(runRow);
    if (!open) {
      this.logger.log(`[refillOne] run=${args.runId} não OPEN/TTL`);
      return;
    }

    if (open.tryCount >= open.targetCount * 3) {
      await this.runs.close(open.id, OutreachSendRunClosedReason.ATTEMPT_CAP);
      return;
    }
    if (open.chargedCount >= open.targetCount) {
      await this.runs.close(open.id, OutreachSendRunClosedReason.TARGET_MET);
      return;
    }

    const canAfford = await this.canAffordOne(open);
    if (!canAfford) {
      this.logger.log(
        `[refillOne] run=${args.runId} saldo insuficiente; skip`,
      );
      return;
    }

    const intervalSeconds = await this.loadSendIntervalSeconds(open);
    if (intervalSeconds > 0) {
      await this.sleep(intervalSeconds * 1000);
    }

    // Re-check após sleep (TTL / charge / try podem ter mudado).
    const afterSleep = await this.prisma.outreachSendRun.findUnique({
      where: { id: args.runId },
    });
    if (!afterSleep) {
      return;
    }
    const stillOpen = await this.runs.ensureOpen(afterSleep);
    if (!stillOpen) {
      return;
    }
    if (
      stillOpen.tryCount >= stillOpen.targetCount * 3 ||
      stillOpen.chargedCount >= stillOpen.targetCount
    ) {
      return;
    }
    if (!(await this.canAffordOne(stillOpen))) {
      return;
    }

    if (stillOpen.channel === OutreachSendRunChannel.CITY) {
      await this.refillCity(stillOpen, args);
      return;
    }
    if (stillOpen.channel === OutreachSendRunChannel.LIST) {
      await this.refillList(stillOpen, args);
    }
  }

  private async refillCity(
    run: OutreachSendRun,
    args: RefillOneArgs,
  ): Promise<void> {
    const lead = await this.pickCityReplacement(run, {
      failedPhone: args.failedPhone,
      wasPremium: args.wasPremium === true,
    });
    if (!lead) {
      this.logger.log(
        `[refillOne] run=${run.id} city sem candidato; EXHAUSTED`,
      );
      await this.runs.close(run.id, OutreachSendRunClosedReason.EXHAUSTED);
      return;
    }

    const allowed = await this.runs.beginTry(run.id);
    if (!allowed) {
      return;
    }

    const sender = args.sendCityLead ?? this.citySender;
    if (!sender) {
      this.logger.warn(
        `[refillOne] run=${run.id} city sender não registrado`,
      );
      return;
    }

    const result = await sender({
      runId: run.id,
      tenantId: run.tenantId,
      lead,
    });
    if (result.accepted) {
      await this.runs.recordAccept(run.id);
      if (result.tenantLeadId != null) {
        await this.prisma.tenantLead.updateMany({
          where: { id: result.tenantLeadId, runId: null },
          data: { runId: run.id },
        });
      }
    }
  }

  private async refillList(
    run: OutreachSendRun,
    args: RefillOneArgs,
  ): Promise<void> {
    if (run.campaignId == null) {
      return;
    }

    const listLead = await this.pickListReplacement(run, {
      failedListLeadId: args.failedListLeadId,
    });
    if (!listLead) {
      this.logger.log(
        `[refillOne] run=${run.id} list sem candidato; EXHAUSTED`,
      );
      await this.runs.close(run.id, OutreachSendRunClosedReason.EXHAUSTED);
      return;
    }

    const allowed = await this.runs.beginTry(run.id);
    if (!allowed) {
      return;
    }

    const sender = args.sendListLead ?? this.listSender;
    if (!sender) {
      this.logger.warn(
        `[refillOne] run=${run.id} list sender não registrado`,
      );
      return;
    }

    const result = await sender({
      runId: run.id,
      tenantId: run.tenantId,
      campaignId: run.campaignId,
      listLead,
    });
    if (result.accepted) {
      await this.runs.recordAccept(run.id);
      if (result.listSendId != null) {
        await this.prisma.tenantListSend.updateMany({
          where: { id: result.listSendId, runId: null },
          data: { runId: run.id },
        });
      }
    }
  }

  /** Exposto para testes de seleção. */
  async pickCityReplacement(
    run: OutreachSendRun,
    opts: { failedPhone?: string; wasPremium: boolean },
  ): Promise<Lead | null> {
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId: run.tenantId },
      select: { categories: true },
    });
    const categories = this.asStringArray(config?.categories);
    if (categories.length === 0) {
      return null;
    }

    const acceptedInRun = await this.prisma.tenantLead.findMany({
      where: { runId: run.id },
      select: { lead: { select: { phone: true } } },
    });
    const runPhones = new Set(
      acceptedInRun.map((row) => row.lead.phone),
    );
    if (opts.failedPhone) {
      runPhones.add(opts.failedPhone);
    }

    const used = await this.prisma.tenantLead.findMany({
      where: cityUsedPhonesWhere(run.tenantId),
      select: { lead: { select: { phone: true } } },
    });
    const excluded = new Set([
      ...runPhones,
      ...used.map((row) => row.lead.phone),
    ]);

    const categoryFilter = this.categoryWhere(categories);
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        AND: [
          categoryFilter,
          {
            phone: {
              not: { contains: '153' },
              ...(excluded.size > 0
                ? { notIn: [...excluded] }
                : {}),
            },
          },
        ],
      },
    });

    const uniquePool = uniqueByPhone(excludeUsedPhones(leads, excluded));
    if (uniquePool.length === 0) {
      return null;
    }

    const allForAvg = await this.prisma.lead.findMany({
      where: { deletedAt: null, ...categoryFilter },
      select: { categories: true, category: true, reviews: true },
    });
    const avgByCategory = buildCategoryAverages(allForAvg, categories);

    const premium: Lead[] = [];
    const regular: Lead[] = [];
    for (const candidate of uniquePool) {
      if (isPremium(candidate, avgByCategory, categories)) {
        premium.push(candidate);
      } else {
        regular.push(candidate);
      }
    }

    if (opts.wasPremium) {
      if (premium.length > 0) {
        return selectStratifiedBatch(premium, [], 1, 1)[0] ?? null;
      }
      return selectStratifiedBatch([], regular, 1, 0)[0] ?? null;
    }

    const P = premium.length;
    const R = regular.length;
    const Y = computeY(P, R, 1);
    const batch = selectStratifiedBatch(premium, regular, 1, Y);
    return batch[0] ?? null;
  }

  async pickListReplacement(
    run: OutreachSendRun,
    opts: { failedListLeadId?: number },
  ): Promise<TenantListLead | null> {
    if (run.campaignId == null) {
      return null;
    }

    const campaign = await this.prisma.tenantListCampaign.findUnique({
      where: { id: run.campaignId },
      select: { listId: true },
    });
    if (!campaign) {
      return null;
    }

    const sentInRun = await this.prisma.tenantListSend.findMany({
      where: { runId: run.id },
      select: { listLeadId: true },
    });
    const excludedIds = new Set(sentInRun.map((s) => s.listLeadId));
    if (opts.failedListLeadId != null) {
      excludedIds.add(opts.failedListLeadId);
    }

    const leads = await this.prisma.tenantListLead.findMany({
      where: {
        listId: campaign.listId,
        ...(excludedIds.size > 0
          ? { id: { notIn: [...excludedIds] } }
          : {}),
      },
      include: {
        sends: {
          orderBy: { sentAt: 'desc' },
          select: {
            campaignId: true,
            sentAt: true,
            lastStatus: true,
          },
        },
      },
    });

    const eligible = leads.filter((lead) => this.isListLeadEligible(lead));
    return eligible[0] ?? null;
  }

  private isListLeadEligible(lead: {
    sendLockCampaignId: number | null;
    sends: Array<{
      campaignId: number;
      sentAt: Date;
      lastStatus: WhatsappDeliveryStatus | null;
    }>;
  }): boolean {
    if (lead.sendLockCampaignId == null) {
      return true;
    }
    const lockId = lead.sendLockCampaignId;
    const lastFromLock = lead.sends
      .filter((s) => s.campaignId === lockId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
    return lastFromLock?.lastStatus === WhatsappDeliveryStatus.failed;
  }

  private async canAffordOne(run: OutreachSendRun): Promise<boolean> {
    const coin = await this.prisma.coin.findFirst({
      where: { tenantId: run.tenantId },
      select: { balance: true },
    });
    const balance = coin?.balance ?? 0;
    const { pendingCity, pendingListAmount, pendingOnDemand } =
      await loadCrossChannelPending(this.prisma, run.tenantId);

    if (run.channel === OutreachSendRunChannel.CITY) {
      const outreach = await this.prisma.tenantOutreachConfig.findUnique({
        where: { tenantId: run.tenantId },
        select: { costPerLead: true, costPerOnDemandSend: true },
      });
      const costPerLead = outreach?.costPerLead ?? 0;
      if (costPerLead <= 0) {
        return false;
      }
      const available = computeAvailableBalance({
        balance,
        pendingCity,
        costPerLead,
        pendingListAmount,
        pendingOnDemand,
        costPerOnDemandSend: outreach?.costPerOnDemandSend ?? 0,
      });
      return affordableFromAvailable(available, costPerLead) >= 1;
    }

    if (run.campaignId == null) {
      return false;
    }
    const campaign = await this.prisma.tenantListCampaign.findUnique({
      where: { id: run.campaignId },
      select: {
        list: { select: { costPerSend: true } },
      },
    });
    const costPerSend = campaign?.list.costPerSend ?? 0;
    if (costPerSend <= 0) {
      return false;
    }
    const outreach = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId: run.tenantId },
      select: { costPerLead: true, costPerOnDemandSend: true },
    });
    const available = computeAvailableBalance({
      balance,
      pendingCity,
      costPerLead: outreach?.costPerLead ?? 0,
      pendingListAmount,
      pendingOnDemand,
      costPerOnDemandSend: outreach?.costPerOnDemandSend ?? 0,
    });
    return affordableFromAvailable(available, costPerSend) >= 1;
  }

  private async loadSendIntervalSeconds(
    run: OutreachSendRun,
  ): Promise<number> {
    if (run.channel === OutreachSendRunChannel.CITY) {
      const config = await this.prisma.tenantOutreachConfig.findUnique({
        where: { tenantId: run.tenantId },
        select: { sendIntervalSeconds: true },
      });
      return config?.sendIntervalSeconds ?? 5;
    }
    if (run.campaignId == null) {
      return 5;
    }
    const campaign = await this.prisma.tenantListCampaign.findUnique({
      where: { id: run.campaignId },
      select: { sendIntervalSeconds: true },
    });
    return campaign?.sendIntervalSeconds ?? 5;
  }

  private asStringArray(value: Prisma.JsonValue | undefined): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((v): v is string => typeof v === 'string');
  }

  private categoryWhere(
    tenantCategories: string[],
  ): Prisma.LeadWhereInput {
    return {
      OR: [
        { categories: { hasSome: tenantCategories } },
        {
          AND: [
            { categories: { isEmpty: true } },
            { category: { in: tenantCategories } },
          ],
        },
      ],
    };
  }

  /** Hook testável para intervalo. */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
