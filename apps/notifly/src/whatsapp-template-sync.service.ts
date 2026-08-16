import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { PlatformJobKey, Prisma } from '@prisma/client';
import { CronJob } from 'cron';
import { parseTemplateSlots } from '@core/shared/whatsapp-template-slots';
import {
  GRAPH_API_VERSION,
  PlatformWhatsappService,
} from './platform-whatsapp.service';

const JOB_NAME = 'whatsapp-template-sync';
const POLL_MS = 60_000;
const FALLBACK_CRON = '0 5 * * *';
const FALLBACK_TZ = 'America/Sao_Paulo';

type GraphTemplatePage = {
  data?: GraphTemplate[];
  paging?: { next?: string };
};

type GraphTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  parameter_format?: string;
  components?: unknown;
};

@Injectable()
export class WhatsappTemplateSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappTemplateSyncService.name);
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
      where: { jobKey: PlatformJobKey.WHATSAPP_TEMPLATE_SYNC },
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
        this.logger.log(
          `[${JOB_NAME}] disabled; cron not registered`,
        );
        return;
      }
      const job = CronJob.from({
        cronTime: desired.cronExpression,
        onTick: () => {
          void this.syncFromGraph();
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

  async syncFromGraph(): Promise<void> {
    try {
      const creds = await this.platformWhatsapp.resolveCredentials();
      if (!creds.wabaId?.trim()) {
        this.logger.warn(`[${JOB_NAME}] wabaId vazio; pulando sync`);
        return;
      }

      const templates = await this.fetchAllTemplates(creds.wabaId, creds.token);
      const now = new Date();
      for (const item of templates) {
        const name = (item.name ?? '').trim();
        const language = (item.language ?? '').trim();
        if (!name || !language) {
          continue;
        }
        const components = (item.components ?? []) as Prisma.InputJsonValue;
        const slots = parseTemplateSlots(item.components) as unknown as Prisma.InputJsonValue;
        await this.prisma.whatsappMessageTemplate.upsert({
          where: {
            whatsappAccountId_name_language: {
              whatsappAccountId: creds.accountId,
              name,
              language,
            },
          },
          create: {
            whatsappAccountId: creds.accountId,
            metaId: item.id ?? null,
            name,
            language,
            status: item.status ?? 'UNKNOWN',
            category: item.category ?? null,
            parameterFormat: item.parameter_format ?? null,
            components,
            slots,
            lastSyncedAt: now,
          },
          update: {
            metaId: item.id ?? null,
            status: item.status ?? 'UNKNOWN',
            category: item.category ?? null,
            parameterFormat: item.parameter_format ?? null,
            components,
            slots,
            lastSyncedAt: now,
          },
        });
      }
      this.logger.log(`[${JOB_NAME}] upserted ${templates.length} templates`);
    } catch (error) {
      this.logger.error(`[${JOB_NAME}] sync failed: ${error}`);
    }
  }

  private async fetchAllTemplates(
    wabaId: string,
    token: string,
  ): Promise<GraphTemplate[]> {
    const collected: GraphTemplate[] = [];
    const fields =
      'id,name,language,status,category,parameter_format,components';
    let url: string | undefined =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?fields=${fields}&limit=100`;

    while (url) {
      const res = await this.httpService.axiosRef.get<GraphTemplatePage>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      collected.push(...(res.data.data ?? []));
      url = res.data.paging?.next;
    }
    return collected;
  }
}
