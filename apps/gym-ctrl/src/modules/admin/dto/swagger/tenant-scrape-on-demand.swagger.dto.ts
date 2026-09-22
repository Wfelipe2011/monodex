import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScrapeOnDemandRunStatus } from '@prisma/client';

export class TenantScrapeOnDemandLastRunDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: ScrapeOnDemandRunStatus })
  status!: ScrapeOnDemandRunStatus;

  @ApiProperty()
  startedAt!: Date;

  @ApiPropertyOptional()
  finishedAt?: Date | null;

  @ApiProperty()
  leadsTouched!: number;

  @ApiProperty()
  bairrosProcessed!: number;
}

export class TenantScrapeOnDemandStatusDto {
  @ApiProperty({ example: 1 })
  runsUsedToday!: number;

  @ApiProperty({ example: 2 })
  dailyLimit!: number;

  @ApiProperty()
  nextBairroIndex!: number;

  @ApiProperty()
  bairroCount!: number;

  @ApiProperty()
  onDemandEnabled!: boolean;

  @ApiPropertyOptional({ type: TenantScrapeOnDemandLastRunDto })
  lastRun?: TenantScrapeOnDemandLastRunDto;
}

export class TenantScrapeOnDemandTriggerResultDto {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  leadsTouched!: number;

  @ApiProperty()
  bairrosProcessed!: number;

  @ApiProperty()
  nextBairroIndex!: number;
}
