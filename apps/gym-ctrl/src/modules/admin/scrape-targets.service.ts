import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CreateScrapeTargetDto } from './dto/create-scrape-target.dto';
import { PatchScrapeTargetDto } from './dto/patch-scrape-target.dto';

const citySelect = {
  id: true,
  name: true,
  state: true,
} satisfies Prisma.CitySelect;

const targetInclude = {
  city: { select: citySelect },
} satisfies Prisma.ScrapeTargetInclude;

@Injectable()
export class ScrapeTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.scrapeTarget.findMany({
      include: targetInclude,
      orderBy: [{ city: { name: 'asc' } }, { category: 'asc' }],
    });
  }

  async create(dto: CreateScrapeTargetDto) {
    const city = await this.resolveCity(dto.cityName, dto.state);
    return this.prisma.scrapeTarget.upsert({
      where: {
        cityId_category: { cityId: city.id, category: dto.category },
      },
      create: {
        cityId: city.id,
        category: dto.category,
        enabled: dto.enabled ?? true,
      },
      update:
        dto.enabled !== undefined ? { enabled: dto.enabled } : {},
      include: targetInclude,
    });
  }

  async getById(id: number) {
    const target = await this.prisma.scrapeTarget.findUnique({
      where: { id },
      include: targetInclude,
    });
    if (!target) {
      throw new NotFoundException(`ScrapeTarget id=${id} não encontrado`);
    }
    return target;
  }

  async patch(id: number, dto: PatchScrapeTargetDto) {
    const existing = await this.getById(id);

    if (dto.category !== undefined && dto.category !== existing.category) {
      const collision = await this.prisma.scrapeTarget.findUnique({
        where: {
          cityId_category: {
            cityId: existing.cityId,
            category: dto.category,
          },
        },
      });
      if (collision) {
        throw new ConflictException(
          `Já existe ScrapeTarget para cityId=${existing.cityId} e category=${dto.category}`,
        );
      }
    }

    return this.prisma.scrapeTarget.update({
      where: { id },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
      include: targetInclude,
    });
  }

  async delete(id: number) {
    const existing = await this.getById(id);
    await this.prisma.scrapeTarget.delete({ where: { id } });
    return existing;
  }

  private async resolveCity(name: string, state?: string) {
    if (state) {
      const byNameAndState = await this.prisma.city.findFirst({
        where: { name, state },
      });
      if (byNameAndState) {
        return byNameAndState;
      }
    }

    const byName = await this.prisma.city.findFirst({ where: { name } });
    if (byName) {
      return byName;
    }

    return this.prisma.city.create({
      data: { name, state: state ?? null },
    });
  }
}
