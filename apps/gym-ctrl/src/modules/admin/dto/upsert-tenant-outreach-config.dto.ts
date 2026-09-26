import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** PUT /tenant: cria config master (sem preço; costPerLead/cashback = 0). */
export class UpsertTenantOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Master pool enabled', default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
