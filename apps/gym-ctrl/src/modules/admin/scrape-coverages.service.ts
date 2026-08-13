import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';

const citySelect = {
  id: true,
  name: true,
  state: true,
} satisfies Prisma.CitySelect;

@Injectable()
export class ScrapeCoveragesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(cityId?: number, category?: string) {
    return this.prisma.scrapeCoverage.findMany({
      where: {
        ...(cityId !== undefined ? { cityId } : {}),
        ...(category !== undefined ? { category } : {}),
      },
      include: { city: { select: citySelect } },
      orderBy: [{ city: { name: 'asc' } }, { category: 'asc' }],
    });
  }
}
