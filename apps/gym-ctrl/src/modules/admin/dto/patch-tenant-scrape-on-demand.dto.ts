import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PatchTenantScrapeOnDemandDto {
  @ApiProperty({ description: 'Liga/desliga scrape on-demand deste par tenant×target' })
  @IsBoolean()
  onDemandEnabled!: boolean;
}
