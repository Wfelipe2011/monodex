import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScrapeLastRunKind, ScrapeSchedulePhase } from '@prisma/client';

export class ScrapeCoverageCityDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  state?: string | null;
}

export class ScrapeCoverageItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  cityId!: number;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  firstRunAt!: Date;

  @ApiProperty()
  lastRunAt!: Date;

  @ApiProperty()
  lastStatus!: string;

  @ApiPropertyOptional()
  lastLeadCount?: number | null;

  @ApiProperty({ enum: ScrapeSchedulePhase })
  schedulePhase!: ScrapeSchedulePhase;

  @ApiPropertyOptional()
  nextScheduledRunAt?: Date | null;

  @ApiProperty()
  scheduledRunCount!: number;

  @ApiPropertyOptional({ enum: ScrapeLastRunKind })
  lastRunKind?: ScrapeLastRunKind | null;

  @ApiProperty({ type: ScrapeCoverageCityDto })
  city!: ScrapeCoverageCityDto;
}
