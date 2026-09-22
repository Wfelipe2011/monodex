import { IsInt, Min } from 'class-validator';

export class OnDemandScrapeDto {
  @IsInt()
  @Min(1)
  tenantId!: number;

  @IsInt()
  @Min(1)
  scrapeTargetId!: number;
}
