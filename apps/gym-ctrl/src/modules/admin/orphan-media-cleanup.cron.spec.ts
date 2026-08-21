import { OrphanMediaCleanupCron } from './orphan-media-cleanup.cron';
import { MediaService } from './media.service';

describe('OrphanMediaCleanupCron', () => {
  function build(opts: {
    scheduleRow: {
      cronExpression: string;
      timeZone: string;
      enabled: boolean;
    } | null;
  }) {
    const prisma = {
      platformJobSchedule: {
        findUnique: jest.fn().mockResolvedValue(opts.scheduleRow),
      },
    };
    const jobs = new Map<string, unknown>();
    const schedulerRegistry = {
      addCronJob: jest.fn((name: string, job: unknown) => {
        jobs.set(name, job);
      }),
      deleteCronJob: jest.fn((name: string) => {
        if (!jobs.has(name)) {
          throw new Error('not found');
        }
        jobs.delete(name);
      }),
    };
    const mediaService = {
      cleanupOrphanFiles: jest.fn().mockResolvedValue({ deleted: 0, kept: 0 }),
    };
    const cron = new OrphanMediaCleanupCron(
      prisma as never,
      schedulerRegistry as never,
      mediaService as unknown as MediaService,
    );
    return { cron, prisma, schedulerRegistry, mediaService, jobs };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enabled=false não registra cron job', async () => {
    const { cron, schedulerRegistry, jobs } = build({
      scheduleRow: {
        cronExpression: '0 3 1,16 * *',
        timeZone: 'America/Sao_Paulo',
        enabled: false,
      },
    });
    await cron.onModuleInit();
    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(jobs.size).toBe(0);
    cron.onModuleDestroy();
  });

  it('enabled=true registra cron job', async () => {
    const { cron, schedulerRegistry, jobs } = build({
      scheduleRow: {
        cronExpression: '0 3 1,16 * *',
        timeZone: 'America/Sao_Paulo',
        enabled: true,
      },
    });
    await cron.onModuleInit();
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'orphan-media-cleanup',
      expect.anything(),
    );
    expect(jobs.size).toBe(1);
    cron.onModuleDestroy();
  });

  it('sem row no banco usa fallback enabled e agenda', async () => {
    const { cron, schedulerRegistry } = build({ scheduleRow: null });
    await cron.onModuleInit();
    expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    cron.onModuleDestroy();
  });
});
