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
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 12 })
  leadsTouched!: number;

  @ApiProperty({ example: 3 })
  bairrosProcessed!: number;

  @ApiProperty({ example: 4 })
  nextBairroIndex!: number;
}

export class TenantScrapeOnDemandPatchResultDto {
  @ApiProperty({ example: true })
  onDemandEnabled!: boolean;
}
