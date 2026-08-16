import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformJobKey } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { UpsertPlatformJobScheduleDto } from './dto/upsert-platform-job-schedule.dto';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

@Injectable()
export class PlatformJobSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.platformJobSchedule.findMany({
      orderBy: { jobKey: 'asc' },
    });
  }

  async getByJobKey(jobKey: PlatformJobKey) {
    const row = await this.prisma.platformJobSchedule.findUnique({
      where: { jobKey },
    });
    if (!row) {
      throw new NotFoundException(
        `PlatformJobSchedule jobKey=${jobKey} não encontrado`,
      );
    }
    return row;
  }

  upsert(jobKey: PlatformJobKey, dto: UpsertPlatformJobScheduleDto) {
    const timeZone = dto.timeZone ?? DEFAULT_TIME_ZONE;
    const enabled = dto.enabled ?? true;
    return this.prisma.platformJobSchedule.upsert({
      where: { jobKey },
      create: {
        jobKey,
        cronExpression: dto.cronExpression,
        timeZone,
        enabled,
      },
      update: {
        cronExpression: dto.cronExpression,
        ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
  }
}
