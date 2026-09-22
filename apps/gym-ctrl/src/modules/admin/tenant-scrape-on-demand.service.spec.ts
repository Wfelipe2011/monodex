import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { ScrapeOnDemandRunStatus } from '@prisma/client';
import {
  ON_DEMAND_DAILY_LIMIT,
  TenantScrapeOnDemandService,
} from './tenant-scrape-on-demand.service';

const TENANT_ID = 3;
const TARGET_ID = 7;
const CITY_ID = 11;

describe('TenantScrapeOnDemandService', () => {
  const prevBase = process.env.CAPTURA_BASE_URL;
  const prevSecret = process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;

  afterEach(() => {
    if (prevBase === undefined) {
      delete process.env.CAPTURA_BASE_URL;
    } else {
      process.env.CAPTURA_BASE_URL = prevBase;
    }
    if (prevSecret === undefined) {
      delete process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;
    } else {
      process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = prevSecret;
    }
  });

  function build(opts?: {
    link?: object | null;
    runsToday?: number;
    state?: object | null;
    policy?: object | null;
  }) {
    const prisma = {
      tenantScrapeTarget: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'link' in opts
            ? opts.link
            : {
                tenantId: TENANT_ID,
                scrapeTargetId: TARGET_ID,
                scrapeTarget: {
                  id: TARGET_ID,
                  cityId: CITY_ID,
                  onDemandAllowed: true,
                  city: { id: CITY_ID, name: 'Sorocaba' },
                },
              },
        ),
      },
      tenantSendPolicy: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.policy ?? { allowedCityIds: [CITY_ID], deniedCityIds: [] },
        ),
      },
      scrapeOnDemandState: {
        findUnique: jest.fn().mockResolvedValue(opts?.state ?? null),
        upsert: jest.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            tenantId: TENANT_ID,
            scrapeTargetId: TARGET_ID,
            onDemandEnabled:
              update?.onDemandEnabled ?? create.onDemandEnabled ?? true,
            bairroOrder: [],
            nextBairroIndex: 0,
          }),
        ),
      },
      scrapeOnDemandRun: {
        count: jest.fn().mockResolvedValue(opts?.runsToday ?? 0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const httpService = {
      axiosRef: {
        post: jest.fn().mockResolvedValue({
          data: {
            status: 'success',
            leadsTouched: 2,
            bairrosProcessed: 1,
            nextBairroIndex: 1,
          },
        }),
      },
    };

    const service = new TenantScrapeOnDemandService(
      prisma as never,
      httpService as never,
    );
    return { service, prisma, httpService };
  }

  it('POST sem vínculo → 404', async () => {
    const { service, httpService } = build({ link: null });
    await expect(service.trigger(TENANT_ID, TARGET_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('POST com quota esgotada → 429 e não chama captura', async () => {
    const { service, httpService } = build({ runsToday: ON_DEMAND_DAILY_LIMIT });
    await expect(service.trigger(TENANT_ID, TARGET_ID)).rejects.toMatchObject({
      status: 429,
    });
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('POST ok chama captura com secret', async () => {
    process.env.CAPTURA_BASE_URL = 'http://captura:4000';
    process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = 'secret';
    const { service, httpService } = build({ runsToday: 1 });
    const result = await service.trigger(TENANT_ID, TARGET_ID);
    expect(result.status).toBe('success');
    expect(httpService.axiosRef.post).toHaveBeenCalledWith(
      'http://captura:4000/internal/scrape/on-demand',
      { tenantId: TENANT_ID, scrapeTargetId: TARGET_ID },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Internal-Secret': 'secret',
        }),
      }),
    );
  });

  it('409 da captura vira ConflictException', async () => {
    process.env.CAPTURA_BASE_URL = 'http://captura:4000';
    process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = 'secret';
    const { service, httpService } = build();
    const axiosError = new AxiosError('conflict');
    axiosError.response = {
      status: 409,
      data: { message: 'Scrape already running', statusCode: 409 },
    } as never;
    httpService.axiosRef.post.mockRejectedValue(axiosError);
    await expect(service.trigger(TENANT_ID, TARGET_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('PATCH só altera onDemandEnabled no state', async () => {
    const { service, prisma } = build();
    const result = await service.patchEnabled(TENANT_ID, TARGET_ID, {
      onDemandEnabled: false,
    });
    expect(result.onDemandEnabled).toBe(false);
    expect(prisma.scrapeOnDemandState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { onDemandEnabled: false },
      }),
    );
  });

  it('GET inclui runsUsedToday e dailyLimit', async () => {
    const { service, prisma } = build({
      state: {
        onDemandEnabled: true,
        bairroOrder: ['Centro', 'Vila'],
        nextBairroIndex: 1,
      },
      runsToday: 1,
    });
    prisma.scrapeOnDemandRun.findFirst.mockResolvedValue({
      id: 99,
      status: ScrapeOnDemandRunStatus.success,
      startedAt: new Date(),
      finishedAt: new Date(),
      leadsTouched: 3,
      bairrosProcessed: 1,
    });
    const status = await service.getStatus(TENANT_ID, TARGET_ID);
    expect(status.runsUsedToday).toBe(1);
    expect(status.dailyLimit).toBe(2);
    expect(status.bairroCount).toBe(2);
    expect(status.lastRun?.id).toBe(99);
  });
});
