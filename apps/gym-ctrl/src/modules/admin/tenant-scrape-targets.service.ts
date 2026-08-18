import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { cityAllowed } from '@core/shared/send-policy';
import { RequestTenantScrapeTargetDto } from './dto/request-tenant-scrape-target.dto';
import { ScrapeTargetsService } from './scrape-targets.service';

const citySelect = {
  id: true,
  name: true,
  state: true,
} satisfies Prisma.CitySelect;

const targetInclude = {
  city: { select: citySelect },
} satisfies Prisma.ScrapeTargetInclude;

@Injectable()
export class TenantScrapeTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapeTargetsService: ScrapeTargetsService,
  ) {}

  async list(tenantId: number) {
    await this.assertTenant(tenantId);
    const links = await this.prisma.tenantScrapeTarget.findMany({
      where: { tenantId },
      include: {
        scrapeTarget: { include: targetInclude },
      },
      orderBy: [
        { scrapeTarget: { city: { name: 'asc' } } },
        { scrapeTarget: { category: 'asc' } },
      ],
    });
    return links.map((link) => link.scrapeTarget);
  }

  async request(tenantId: number, dto: RequestTenantScrapeTargetDto) {
    await this.assertTenant(tenantId);
    const city = await this.scrapeTargetsService.resolveCity(
      dto.cityName,
      dto.state,
    );

    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
      select: { allowedCityIds: true, deniedCityIds: true },
    });
    const allowed = asIntArray(policy?.allowedCityIds);
    const denied = asIntArray(policy?.deniedCityIds);
    if (!cityAllowed(city.id, allowed, denied)) {
      throw new BadRequestException(
        `Cidade id=${city.id} fora da política de envio do tenant`,
      );
    }

    const scrapeTarget = await this.prisma.scrapeTarget.upsert({
      where: {
        cityId_category: { cityId: city.id, category: dto.category },
      },
      create: {
        cityId: city.id,
        category: dto.category,
        enabled: true,
      },
      update: {},
      include: targetInclude,
    });

    await this.prisma.tenantScrapeTarget.upsert({
      where: {
        tenantId_scrapeTargetId: {
          tenantId,
          scrapeTargetId: scrapeTarget.id,
        },
      },
      create: { tenantId, scrapeTargetId: scrapeTarget.id },
      update: {},
    });

    return scrapeTarget;
  }

  private async assertTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }
}

function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n >= 1);
}
