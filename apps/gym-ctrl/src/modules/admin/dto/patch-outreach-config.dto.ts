import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** PATCH /tenant: master enabled apenas. Preço no body → 403. */
export class PatchOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Master pool enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
