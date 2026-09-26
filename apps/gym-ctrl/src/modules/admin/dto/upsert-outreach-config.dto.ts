import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { BINDING_TYPES } from '@core/shared/whatsapp-template-bindings';

export class SlotBindingEntryDto {
  @ApiProperty({ enum: BINDING_TYPES })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;
}

export class SlotBindingsDto {
  @ApiProperty({
    description: 'Bindings do template de outreach, keyed por slot',
    example: {
      'body.1': { type: 'literal', value: 'Gladson Teixeira' },
    },
  })
  @IsObject()
  outreach: Record<string, SlotBindingEntryDto>;

  @ApiProperty({
    description: 'Bindings do template de notify, keyed por slot',
    example: {
      'body.customer_name': { type: 'lead.name' },
    },
  })
  @IsObject()
  notify: Record<string, SlotBindingEntryDto>;
}

/** PUT platform bootstrap: master pricing + WhatsApp; sem campos de campanha. */
export class UpsertOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Master pool enabled', default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Custo em coins por lead contatado', example: 0.35 })
  @IsNumber()
  costPerLead: number;

  @ApiPropertyOptional({ description: 'Cashback ao receber reply', default: 0 })
  @IsOptional()
  @IsNumber()
  cashbackOnReply?: number;

  @ApiPropertyOptional({
    description:
      'Conta WhatsApp dedicada (não-default). Omitido ou null = remetente default da plataforma',
    nullable: true,
    example: 2,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  whatsappAccountId?: number | null;
}
