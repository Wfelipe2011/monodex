import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CronJob } from 'cron';
import { CapturaScraperService } from './captura-scraper.service';

const JOB_NAME = 'platform-scrape';
const FALLBACK = {
  cronExpression: '0 6 * * *',
  timeZone: 'America/Sao_Paulo',
  enabled: true,
} as const;

type ScheduleSnapshot = {
  cronExpression: string;
  timeZone: string;
  enabled: boolean;
};

@Injectable()
export class DynamicScrapeCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicScrapeCronService.name);
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private applied: ScheduleSnapshot | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly scraper: CapturaScraperService,
  ) {}

  async onModuleInit() {
    await this.syncFromDb();
    this.pollTimer = setInterval(() => {
      void this.syncFromDb();
    }, 60_000);
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
      where: { jobKey: 'SCRAPE' },
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
        `[scrape-cron] disabled (expression=${next.cronExpression} tz=${next.timeZone})`,
      );
      return;
    }

    const job = CronJob.from({
      cronTime: next.cronExpression,
      timeZone: next.timeZone,
      onTick: () => {
        void this.scraper.handleMorningScrape();
      },
      start: true,
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    this.applied = next;
    this.logger.log(
      `[scrape-cron] registered expression=${next.cronExpression} tz=${next.timeZone}`,
    );
  }

  private removeCronIfPresent() {
    try {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    } catch {
      // job not registered
    }
  }
}
