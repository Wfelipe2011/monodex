import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

/** PATCH /platform: preço e número WhatsApp. Campos tenant-owned no body → 403. */
export class PatchPlatformOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Custo em coins por lead contatado' })
  @IsOptional()
  @IsNumber()
  costPerLead?: number;

  @ApiPropertyOptional({ description: 'Cashback ao receber reply' })
  @IsOptional()
  @IsNumber()
  cashbackOnReply?: number;

  @ApiPropertyOptional({
    description:
      'Conta WhatsApp dedicada (não-default). null = remetente default da plataforma',
    nullable: true,
    example: 2,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  whatsappAccountId?: number | null;
}
