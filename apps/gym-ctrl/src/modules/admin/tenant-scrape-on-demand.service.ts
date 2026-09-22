import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { cityAllowed } from '@core/shared/send-policy';
import { isAxiosError } from 'axios';
import { saoPauloDayRange } from './ops.service';
import { PatchTenantScrapeOnDemandDto } from './dto/patch-tenant-scrape-on-demand.dto';

export const ON_DEMAND_DAILY_LIMIT = 2;

type CapturaOnDemandResponse = {
  status: string;
  leadsTouched: number;
  bairrosProcessed: number;
  nextBairroIndex: number;
};

@Injectable()
export class TenantScrapeOnDemandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async getStatus(tenantId: number, scrapeTargetId: number) {
    await this.assertLinkedTarget(tenantId, scrapeTargetId);
    const [state, runsUsedToday, lastRun] = await Promise.all([
      this.prisma.scrapeOnDemandState.findUnique({
        where: {
          tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
        },
      }),
      this.countRunsToday(tenantId, scrapeTargetId),
      this.prisma.scrapeOnDemandRun.findFirst({
        where: { tenantId, scrapeTargetId },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const bairroOrder = parseBairroOrder(state?.bairroOrder);
    return {
      runsUsedToday,
      dailyLimit: ON_DEMAND_DAILY_LIMIT,
      nextBairroIndex: state?.nextBairroIndex ?? 0,
      bairroCount: bairroOrder.length,
      onDemandEnabled: state?.onDemandEnabled ?? true,
      ...(lastRun
        ? {
            lastRun: {
              id: lastRun.id,
              status: lastRun.status,
              startedAt: lastRun.startedAt,
              finishedAt: lastRun.finishedAt,
              leadsTouched: lastRun.leadsTouched,
              bairrosProcessed: lastRun.bairrosProcessed,
            },
          }
        : {}),
    };
  }

  async patchEnabled(
    tenantId: number,
    scrapeTargetId: number,
    dto: PatchTenantScrapeOnDemandDto,
  ) {
    await this.assertLinkedTarget(tenantId, scrapeTargetId);
    const state = await this.prisma.scrapeOnDemandState.upsert({
      where: {
        tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
      },
      create: {
        tenantId,
        scrapeTargetId,
        onDemandEnabled: dto.onDemandEnabled,
      },
      update: {
        onDemandEnabled: dto.onDemandEnabled,
      },
    });
    return {
      onDemandEnabled: state.onDemandEnabled,
    };
  }

  async trigger(tenantId: number, scrapeTargetId: number) {
    const link = await this.prisma.tenantScrapeTarget.findUnique({
      where: {
        tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
      },
      include: {
        scrapeTarget: { include: { city: true } },
      },
    });
    if (!link) {
      throw new NotFoundException(
        `Vínculo tenant=${tenantId} scrapeTarget=${scrapeTargetId} não encontrado`,
      );
    }

    const target = link.scrapeTarget;
    if (!target.onDemandAllowed) {
      throw new ConflictException(
        'Scrape on-demand desabilitado na plataforma para este target',
      );
    }

    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
      select: { allowedCityIds: true, deniedCityIds: true },
    });
    const allowed = asIntArray(policy?.allowedCityIds);
    const denied = asIntArray(policy?.deniedCityIds);
    if (!cityAllowed(target.cityId, allowed, denied)) {
      throw new BadRequestException(
        `Cidade id=${target.cityId} fora da política de envio do tenant`,
      );
    }

    const state = await this.prisma.scrapeOnDemandState.findUnique({
      where: {
        tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
      },
    });
    if (state && !state.onDemandEnabled) {
      throw new ConflictException('On-demand desabilitado para este par');
    }

    const runsUsedToday = await this.countRunsToday(tenantId, scrapeTargetId);
    if (runsUsedToday >= ON_DEMAND_DAILY_LIMIT) {
      throw new HttpException(
        `Quota diária de scrape on-demand esgotada (${ON_DEMAND_DAILY_LIMIT}/dia)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const base = process.env.CAPTURA_BASE_URL;
    const secret = process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;
    if (!base || !secret) {
      throw new ServiceUnavailableException(
        'CAPTURA_BASE_URL ou CAPTURA_INTERNAL_SCRAPE_SECRET não configurados',
      );
    }

    try {
      const res = await this.httpService.axiosRef.post<CapturaOnDemandResponse>(
        `${base.replace(/\/$/, '')}/internal/scrape/on-demand`,
        { tenantId, scrapeTargetId },
        {
          headers: {
            'X-Internal-Secret': secret,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        },
      );
      return res.data;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const message =
          extractNestMessage(err.response.data) ??
          'Scrape em andamento para este par; tente novamente mais tarde';
        throw new ConflictException(message);
      }
      throw err;
    }
  }

  async countRunsToday(tenantId: number, scrapeTargetId: number): Promise<number> {
    const { todayStart, tomorrowStart } = saoPauloDayRange(new Date());
    return this.prisma.scrapeOnDemandRun.count({
      where: {
        tenantId,
        scrapeTargetId,
        startedAt: { gte: todayStart, lt: tomorrowStart },
      },
    });
  }

  private async assertLinkedTarget(tenantId: number, scrapeTargetId: number) {
    const link = await this.prisma.tenantScrapeTarget.findUnique({
      where: {
        tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
      },
    });
    if (!link) {
      throw new NotFoundException(
        `Vínculo tenant=${tenantId} scrapeTarget=${scrapeTargetId} não encontrado`,
      );
    }
  }
}

function parseBairroOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string');
}

function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n >= 1);
}

function extractNestMessage(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const msg = (data as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
    if (Array.isArray(msg) && typeof msg[0] === 'string') {
      return msg[0];
    }
  }
  return undefined;
}
