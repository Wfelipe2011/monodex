import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  computeAvailableBalance,
  pendingUnchargedCityWhere,
  pendingUnchargedListSendsWhere,
  pendingUnchargedOnDemandWhere,
} from '@core/shared/on-demand-balance';
import { isDedicatedPlatformAccount } from '@core/shared/whatsapp-conversation';
import { buildTemplateSendBody } from '@core/shared/whatsapp-template-payload';
import {
  parseTemplateSlots,
  TemplateSlot,
} from '@core/shared/whatsapp-template-slots';
import {
  OnDemandScheduleStatus,
  OnDemandSendSource,
  PlatformJobKey,
  Prisma,
  WhatsappConversationDirection,
} from '@prisma/client';
import { CronJob } from 'cron';
import { PlatformWhatsappService } from './platform-whatsapp.service';

const JOB_NAME = 'on-demand-schedule-run';
const POLL_MS = 60_000;
const FALLBACK_CRON = '0 * * * *';
const FALLBACK_TZ = 'America/Sao_Paulo';

type GraphSendResponse = {
  messages?: { id?: string; message_status?: string }[];
};

type DueSchedule = {
  id: number;
  tenantId: number;
  templateId: number;
  phone: string;
  scheduledFor: Date;
  variables: Prisma.JsonValue;
  mediaId: number | null;
  leadId: number | null;
};

@Injectable()
export class OnDemandScheduleCronService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OnDemandScheduleCronService.name);
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private appliedSignature: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly platformWhatsapp: PlatformWhatsappService,
  ) {}

  onModuleInit() {
    void this.reconcileSchedule();
    this.pollHandle = setInterval(() => {
      void this.reconcileSchedule();
    }, POLL_MS);
    this.pollHandle.unref?.();
  }

  onModuleDestroy() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.removeJobIfPresent();
  }

  private async loadDesired(): Promise<{
    enabled: boolean;
    cronExpression: string;
    timeZone: string;
  }> {
    const row = await this.prisma.platformJobSchedule.findUnique({
      where: { jobKey: PlatformJobKey.ON_DEMAND_SCHEDULE_RUN },
    });
    if (!row) {
      return {
        enabled: true,
        cronExpression: FALLBACK_CRON,
        timeZone: FALLBACK_TZ,
      };
    }
    return {
      enabled: row.enabled,
      cronExpression: row.cronExpression,
      timeZone: row.timeZone,
    };
  }

  private signature(desired: {
    enabled: boolean;
    cronExpression: string;
    timeZone: string;
  }): string {
    return `${desired.enabled}|${desired.cronExpression}|${desired.timeZone}`;
  }

  async reconcileSchedule(): Promise<void> {
    try {
      const desired = await this.loadDesired();
      const next = this.signature(desired);
      if (next === this.appliedSignature) {
        return;
      }
      this.removeJobIfPresent();
      this.appliedSignature = next;
      if (!desired.enabled) {
        this.logger.log(`[${JOB_NAME}] disabled; cron not registered`);
        return;
      }
      const job = CronJob.from({
        cronTime: desired.cronExpression,
        onTick: () => {
          void this.runDueSchedules();
        },
        start: false,
        timeZone: desired.timeZone,
      });
      this.schedulerRegistry.addCronJob(JOB_NAME, job);
      job.start();
      this.logger.log(
        `[${JOB_NAME}] registered cron="${desired.cronExpression}" tz="${desired.timeZone}"`,
      );
    } catch (error) {
      this.logger.error(`[${JOB_NAME}] failed to reconcile schedule: ${error}`);
    }
  }

  private removeJobIfPresent() {
    if (this.schedulerRegistry.doesExist('cron', JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    }
  }

  /** Processa agendas PENDING com scheduledFor <= now. */
  async runDueSchedules(now: Date = new Date()): Promise<void> {
    const due = await this.prisma.tenantOnDemandSchedule.findMany({
      where: {
        status: OnDemandScheduleStatus.PENDING,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
      select: {
        id: true,
        tenantId: true,
        templateId: true,
        phone: true,
        scheduledFor: true,
        variables: true,
        mediaId: true,
        leadId: true,
      },
    });

    for (const schedule of due) {
      try {
        await this.processOne(schedule);
      } catch (error) {
        this.logger.error(
          `[${JOB_NAME}] schedule id=${schedule.id} failed unexpectedly: ${error}`,
        );
      }
    }
  }

  /**
   * Preflight → claim PENDING→SENT → Graph → persist send.
   * Claim antes do Graph evita double-send entre ticks/instâncias.
   * Graph fail após claim → FAILED.
   */
  async processOne(schedule: DueSchedule): Promise<'sent' | 'failed' | 'skipped'> {
    const preflight = await this.preflight(schedule);
    if (preflight.ok === false) {
      const marked = await this.prisma.tenantOnDemandSchedule.updateMany({
        where: {
          id: schedule.id,
          status: OnDemandScheduleStatus.PENDING,
        },
        data: {
          status: OnDemandScheduleStatus.FAILED,
          failedReason: preflight.reason,
        },
      });
      if (marked.count === 0) {
        return 'skipped';
      }
      this.logger.warn(
        `[${JOB_NAME}] schedule id=${schedule.id} FAILED preflight: ${preflight.reason}`,
      );
      return 'failed';
    }

    const claimed = await this.prisma.tenantOnDemandSchedule.updateMany({
      where: {
        id: schedule.id,
        status: OnDemandScheduleStatus.PENDING,
      },
      data: { status: OnDemandScheduleStatus.SENT },
    });
    if (claimed.count !== 1) {
      return 'skipped';
    }

    try {
      const wamid = await this.sendGraph(schedule, preflight);
      const leadName = await this.resolveLeadName(schedule.leadId);
      const conversationId = await this.persistConversation({
        tenantId: schedule.tenantId,
        phone: schedule.phone,
        wamid,
        templateName: preflight.templateName,
        graphPayload: preflight.graphPayload,
        leadName,
      });

      const send = await this.prisma.tenantOnDemandSend.create({
        data: {
          tenantId: schedule.tenantId,
          templateId: schedule.templateId,
          phone: schedule.phone,
          wamid,
          variables: preflight.values as Prisma.InputJsonValue,
          mediaId: schedule.mediaId,
          source: OnDemandSendSource.SCHEDULE,
          scheduleId: schedule.id,
          conversationId,
          coinDebitedAt: null,
        },
      });

      await this.prisma.tenantOnDemandSchedule.update({
        where: { id: schedule.id },
        data: { onDemandSendId: send.id },
      });

      this.logger.log(
        `[${JOB_NAME}] schedule id=${schedule.id} SENT sendId=${send.id} wamid=${wamid}`,
      );
      return 'sent';
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message.slice(0, 200)
          : 'graph_or_persist_error';
      await this.prisma.tenantOnDemandSchedule.updateMany({
        where: {
          id: schedule.id,
          status: OnDemandScheduleStatus.SENT,
          onDemandSendId: null,
        },
        data: {
          status: OnDemandScheduleStatus.FAILED,
          failedReason: reason,
        },
      });
      this.logger.error(
        `[${JOB_NAME}] schedule id=${schedule.id} Graph/persist failed: ${reason}`,
      );
      return 'failed';
    }
  }

  private async preflight(
    schedule: DueSchedule,
  ): Promise<
    | {
        ok: true;
        templateName: string;
        language: string;
        slots: TemplateSlot[];
        values: Record<string, string>;
        graphPayload: Record<string, unknown>;
        messagesUrl: string;
        token: string;
      }
    | { ok: false; reason: string }
  > {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: schedule.tenantId },
      select: { id: true, active: true },
    });
    if (!tenant) {
      return { ok: false, reason: 'tenant_not_found' };
    }
    if (!tenant.active) {
      return { ok: false, reason: 'tenant_inactive' };
    }

    const outreach = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId: schedule.tenantId },
      select: {
        costPerOnDemandSend: true,
        costPerLead: true,
        whatsappAccountId: true,
        whatsappAccount: { select: { isDefault: true } },
      },
    });
    const costPerOnDemandSend = outreach?.costPerOnDemandSend ?? 0;
    if (costPerOnDemandSend <= 0) {
      return { ok: false, reason: 'cost_per_on_demand_closed' };
    }
    if (
      outreach?.whatsappAccountId == null ||
      !outreach.whatsappAccount ||
      !isDedicatedPlatformAccount(outreach.whatsappAccount)
    ) {
      return { ok: false, reason: 'no_dedicated_whatsapp' };
    }

    const grant = await this.prisma.tenantTemplateGrant.findUnique({
      where: {
        tenantId_templateId: {
          tenantId: schedule.tenantId,
          templateId: schedule.templateId,
        },
      },
      include: { template: true },
    });
    if (!grant) {
      return { ok: false, reason: 'template_grant_revoked' };
    }
    if (grant.template.status.toUpperCase() !== 'APPROVED') {
      return { ok: false, reason: 'template_not_approved' };
    }

    const balanceOk = await this.hasAvailableBalance(
      schedule.tenantId,
      costPerOnDemandSend,
      outreach.costPerLead ?? 0,
    );
    if (!balanceOk) {
      return { ok: false, reason: 'insufficient_balance' };
    }

    const slots = this.asSlots(
      grant.template.slots,
      grant.template.components,
    );
    const values = this.asStringRecord(schedule.variables);

    if (schedule.mediaId != null) {
      const media = await this.prisma.tenantMedia.findFirst({
        where: { id: schedule.mediaId, tenantId: schedule.tenantId },
        select: { id: true, publicId: true },
      });
      if (!media) {
        return { ok: false, reason: 'media_missing' };
      }
      const url = this.publicMediaUrl(media.publicId);
      if (!url) {
        return { ok: false, reason: 'public_api_base_url_missing' };
      }
      for (const slot of slots) {
        if (slot.paramType === 'image' || slot.key === 'header.image') {
          values[slot.key] = url;
        }
      }
    }

    let creds: { messagesUrl: string; token: string };
    try {
      creds = await this.platformWhatsapp.resolveCredentials(schedule.tenantId);
    } catch {
      return { ok: false, reason: 'whatsapp_credentials_unavailable' };
    }

    const sendBody = buildTemplateSendBody({
      name: grant.template.name,
      language: grant.template.language,
      slots,
      values,
    });
    const graphPayload = {
      ...sendBody,
      recipient_type: 'individual' as const,
      to: schedule.phone,
    };

    return {
      ok: true,
      templateName: grant.template.name,
      language: grant.template.language,
      slots,
      values,
      graphPayload,
      messagesUrl: creds.messagesUrl,
      token: creds.token,
    };
  }

  private async hasAvailableBalance(
    tenantId: number,
    costPerOnDemandSend: number,
    costPerLead: number,
  ): Promise<boolean> {
    const coin = await this.prisma.coin.findFirst({
      where: { tenantId },
      select: { balance: true },
    });
    const balance = coin?.balance ?? 0;

    const [pendingCity, pendingOnDemand, lists] = await Promise.all([
      this.prisma.tenantLead.count({
        where: pendingUnchargedCityWhere(tenantId),
      }),
      this.prisma.tenantOnDemandSend.count({
        where: pendingUnchargedOnDemandWhere(tenantId),
      }),
      this.prisma.tenantLeadList.findMany({
        where: { tenantId },
        select: { id: true, costPerSend: true },
      }),
    ]);

    let pendingListAmount = 0;
    for (const list of lists) {
      const pending = await this.prisma.tenantListSend.count({
        where: pendingUnchargedListSendsWhere(list.id),
      });
      pendingListAmount += pending * list.costPerSend;
    }

    const available = computeAvailableBalance({
      balance,
      pendingCity,
      costPerLead,
      pendingListAmount,
      pendingOnDemand,
      costPerOnDemandSend,
    });
    return available >= costPerOnDemandSend;
  }

  private async sendGraph(
    schedule: DueSchedule,
    preflight: {
      graphPayload: Record<string, unknown>;
      messagesUrl: string;
      token: string;
    },
  ): Promise<string> {
    const res = await this.httpService.axiosRef.post<GraphSendResponse>(
      preflight.messagesUrl,
      preflight.graphPayload,
      {
        headers: {
          Authorization: `Bearer ${preflight.token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const wamid = res.data.messages?.[0]?.id ?? '';
    if (!wamid) {
      throw new Error('Graph API não retornou wamid');
    }
    return wamid;
  }

  private async persistConversation(input: {
    tenantId: number;
    phone: string;
    wamid: string;
    templateName: string;
    graphPayload: Record<string, unknown>;
    leadName: string | null;
  }): Promise<number> {
    const trimmedLeadName = input.leadName?.trim() ?? '';
    const displayName =
      trimmedLeadName.length > 0 ? trimmedLeadName : input.phone;
    const now = new Date();

    const conversation = await this.prisma.whatsappConversation.upsert({
      where: {
        tenantId_phone: { tenantId: input.tenantId, phone: input.phone },
      },
      create: {
        tenantId: input.tenantId,
        phone: input.phone,
        displayName,
        lastMessageAt: now,
      },
      update: { lastMessageAt: now },
    });

    await this.prisma.whatsappConversationMessage.create({
      data: {
        wamid: input.wamid,
        direction: WhatsappConversationDirection.OUT,
        type: 'template',
        body: input.templateName,
        raw: input.graphPayload as Prisma.InputJsonValue,
        phone: input.phone,
        tenantId: input.tenantId,
        conversationId: conversation.id,
      },
    });

    return conversation.id;
  }

  private async resolveLeadName(leadId: number | null): Promise<string | null> {
    if (leadId == null) {
      return null;
    }
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { name: true },
    });
    return lead?.name ?? null;
  }

  private publicMediaUrl(publicId: string): string | null {
    const base = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (!base) {
      return null;
    }
    return `${base}/public/media/${publicId}`;
  }

  private asStringRecord(json: Prisma.JsonValue): Record<string, string> {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (typeof v === 'string') {
        out[k] = v;
      }
    }
    return out;
  }

  private asSlots(slotsJson: unknown, components: unknown): TemplateSlot[] {
    if (Array.isArray(slotsJson) && slotsJson.length > 0) {
      return slotsJson as TemplateSlot[];
    }
    return parseTemplateSlots(components);
  }
}
