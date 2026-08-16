import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
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

/** PUT: upsert completo — campos required (exceto defaults sensatos). */
export class UpsertOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Habilitar outreach', default: false })
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

  @ApiProperty({ description: 'FK do template de outreach no catálogo' })
  @IsInt()
  @Min(1)
  outreachTemplateId: number;

  @ApiProperty({ description: 'FK do template de notify no catálogo' })
  @IsInt()
  @Min(1)
  notifyTemplateId: number;

  @ApiProperty({ type: SlotBindingsDto })
  @ValidateNested()
  @Type(() => SlotBindingsDto)
  slotBindings: SlotBindingsDto;

  @ApiProperty({
    description: 'Mapa dia-da-semana → horas UTC',
    example: { '2': [18], '3': [18], '4': [13, 18] },
  })
  @IsObject()
  schedule: Record<string, number[]>;

  @ApiProperty({
    description: 'Categorias de leads',
    type: [String],
    example: ['Construtoras', 'Clínicas médicas'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categories: string[];

  @ApiPropertyOptional({
    description: 'Leads contactados por execução (default 5)',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  leadsPerRun?: number;

  @ApiPropertyOptional({
    description: 'Intervalo em segundos entre envios (default 5)',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;
}
