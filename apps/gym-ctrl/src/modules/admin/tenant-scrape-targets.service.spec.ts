import { BadRequestException } from '@nestjs/common';
import { TenantScrapeTargetsService } from './tenant-scrape-targets.service';

describe('TenantScrapeTargetsService', () => {
  const tenantId = 4;
  const city = { id: 1, name: 'Taubaté', state: 'SP' };
  const dto = { cityName: 'Taubaté', state: 'SP', category: 'Construtoras' };

  function build(overrides?: {
    policy?: { allowedCityIds: unknown; deniedCityIds: unknown } | null;
    existingTarget?: { id: number; enabled: boolean };
  }) {
    const scrapeTarget = {
      id: overrides?.existingTarget?.id ?? 7,
      cityId: city.id,
      category: dto.category,
      enabled: overrides?.existingTarget?.enabled ?? true,
      city,
    };
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantId }),
      },
      tenantSendPolicy: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            overrides?.policy === undefined
              ? { allowedCityIds: [], deniedCityIds: [] }
              : overrides.policy,
          ),
      },
      scrapeTarget: {
        upsert: jest.fn().mockResolvedValue(scrapeTarget),
      },
      tenantScrapeTarget: {
        upsert: jest.fn().mockResolvedValue({
          tenantId,
          scrapeTargetId: scrapeTarget.id,
        }),
        findMany: jest.fn(),
      },
    };
    const scrapeTargetsService = {
      resolveCity: jest.fn().mockResolvedValue(city),
    };
    const service = new TenantScrapeTargetsService(
      prisma as never,
      scrapeTargetsService as never,
    );
    return { service, prisma, scrapeTargetsService, scrapeTarget };
  }

  it('par novo cria ScrapeTarget com enabled=true', async () => {
    const { service, prisma } = build();
    await service.request(tenantId, dto);
    expect(prisma.scrapeTarget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cityId: city.id,
          category: dto.category,
          enabled: true,
        }),
        update: {},
      }),
    );
    expect(prisma.tenantScrapeTarget.upsert).toHaveBeenCalled();
  });

  it('share de target existente não altera enabled (update vazio)', async () => {
    const { service, prisma } = build({
      existingTarget: { id: 7, enabled: false },
    });
    const result = await service.request(tenantId, dto);
    expect(prisma.scrapeTarget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
    expect(result.enabled).toBe(false);
    expect(prisma.tenantScrapeTarget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_scrapeTargetId: { tenantId, scrapeTargetId: 7 },
        },
        update: {},
      }),
    );
  });

  it('segunda request do mesmo tenant é idempotente (um link)', async () => {
    const { service, prisma } = build();
    await service.request(tenantId, dto);
    await service.request(tenantId, dto);
    expect(prisma.tenantScrapeTarget.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.tenantScrapeTarget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_scrapeTargetId: { tenantId, scrapeTargetId: 7 },
        },
        create: { tenantId, scrapeTargetId: 7 },
        update: {},
      }),
    );
  });

  it('cidade fora do allow → 400 sem criar link', async () => {
    const { service, prisma, scrapeTargetsService } = build({
      policy: { allowedCityIds: [99], deniedCityIds: [] },
    });
    scrapeTargetsService.resolveCity.mockResolvedValue({
      id: 2,
      name: 'Lorena',
      state: 'SP',
    });
    await expect(service.request(tenantId, { ...dto, cityName: 'Lorena' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.scrapeTarget.upsert).not.toHaveBeenCalled();
    expect(prisma.tenantScrapeTarget.upsert).not.toHaveBeenCalled();
  });

  it('Admin com denylist da cidade → 400', async () => {
    const { service, prisma } = build({
      policy: { allowedCityIds: [], deniedCityIds: [1] },
    });
    await expect(service.request(tenantId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tenantScrapeTarget.upsert).not.toHaveBeenCalled();
  });

  it('policy ausente trata arrays vazios (sem restrição)', async () => {
    const { service, prisma } = build({ policy: null });
    await service.request(tenantId, dto);
    expect(prisma.scrapeTarget.upsert).toHaveBeenCalled();
    expect(prisma.tenantScrapeTarget.upsert).toHaveBeenCalled();
  });

  it('GET lista só vínculos do tenant e inclui enabled', async () => {
    const { service, prisma } = build();
    prisma.tenantScrapeTarget.findMany.mockResolvedValue([
      {
        scrapeTarget: {
          id: 1,
          enabled: false,
          category: 'Construtoras',
          city: city,
        },
      },
    ]);
    const listed = await service.list(tenantId);
    expect(prisma.tenantScrapeTarget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(listed).toEqual([
      expect.objectContaining({ id: 1, enabled: false }),
    ]);
  });
});
