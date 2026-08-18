import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

/** PATCH /platform: só preço. Campos tenant-owned no body → 403. */
export class PatchPlatformOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Custo em coins por lead contatado' })
  @IsOptional()
  @IsNumber()
  costPerLead?: number;

  @ApiPropertyOptional({ description: 'Cashback ao receber reply' })
  @IsOptional()
  @IsNumber()
  cashbackOnReply?: number;
}
