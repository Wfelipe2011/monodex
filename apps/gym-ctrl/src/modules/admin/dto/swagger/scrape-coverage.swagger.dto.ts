import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScrapeLastRunKind, ScrapeSchedulePhase } from '@prisma/client';

export class ScrapeCoverageCityDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Taubaté' })
  name!: string;

  @ApiPropertyOptional({ example: 'SP' })
  state?: string | null;
}

export class ScrapeCoverageItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 3 })
  cityId!: number;

  @ApiProperty({ example: 'Construtoras' })
  category!: string;

  @ApiProperty({ example: '2026-08-01T03:00:00.000Z' })
  firstRunAt!: Date;

  @ApiProperty({ example: '2026-09-24T03:00:00.000Z' })
  lastRunAt!: Date;

  @ApiProperty({ example: 'ok' })
  lastStatus!: string;

  @ApiPropertyOptional({ example: 42 })
  lastLeadCount?: number | null;

  @ApiProperty({ enum: ScrapeSchedulePhase, example: 'BOOTSTRAP' })
  schedulePhase!: ScrapeSchedulePhase;

  @ApiPropertyOptional({ example: '2026-09-25T03:00:00.000Z' })
  nextScheduledRunAt?: Date | null;

  @ApiProperty({ example: 12 })
  scheduledRunCount!: number;

  @ApiPropertyOptional({ enum: ScrapeLastRunKind, example: 'SCHEDULED' })
  lastRunKind?: ScrapeLastRunKind | null;

  @ApiProperty({ type: ScrapeCoverageCityDto })
  city!: ScrapeCoverageCityDto;
}
