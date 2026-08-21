import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CronJob } from 'cron';
import { MediaService } from './media.service';

const JOB_NAME = 'orphan-media-cleanup';
const FALLBACK = {
  cronExpression: '0 3 1,16 * *',
  timeZone: 'America/Sao_Paulo',
  enabled: true,
} as const;

type ScheduleSnapshot = {
  cronExpression: string;
  timeZone: string;
  enabled: boolean;
};

@Injectable()
export class OrphanMediaCleanupCron
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OrphanMediaCleanupCron.name);
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private applied: ScheduleSnapshot | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly mediaService: MediaService,
  ) {}

  async onModuleInit() {
    await this.syncFromDb();
    this.pollTimer = setInterval(() => {
      void this.syncFromDb();
    }, 60_000);
    this.pollTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.removeCronIfPresent();
  }

  private async syncFromDb() {
    const row = await this.prisma.platformJobSchedule.findUnique({
      where: { jobKey: 'ORPHAN_MEDIA_CLEANUP' },
    });
    const next: ScheduleSnapshot = row
      ? {
          cronExpression: row.cronExpression,
          timeZone: row.timeZone,
          enabled: row.enabled,
        }
      : { ...FALLBACK };

    if (
      this.applied &&
      this.applied.cronExpression === next.cronExpression &&
      this.applied.timeZone === next.timeZone &&
      this.applied.enabled === next.enabled
    ) {
      return;
    }

    this.removeCronIfPresent();

    if (!next.enabled) {
      this.applied = next;
      this.logger.log(
        `[orphan-media-cleanup] disabled (expression=${next.cronExpression} tz=${next.timeZone})`,
      );
      return;
    }

    const job = CronJob.from({
      cronTime: next.cronExpression,
      timeZone: next.timeZone,
      onTick: () => {
        void this.runCleanup();
      },
      start: true,
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    this.applied = next;
    this.logger.log(
      `[orphan-media-cleanup] registered expression=${next.cronExpression} tz=${next.timeZone}`,
    );
  }

  private async runCleanup() {
    try {
      const result = await this.mediaService.cleanupOrphanFiles();
      this.logger.log(
        `[orphan-media-cleanup] done deleted=${result.deleted} kept=${result.kept}`,
      );
    } catch (err) {
      this.logger.error(
        `[orphan-media-cleanup] failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private removeCronIfPresent() {
    try {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    } catch {
      // job not registered
    }
  }
}
