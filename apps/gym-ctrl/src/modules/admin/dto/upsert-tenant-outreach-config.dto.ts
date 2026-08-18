import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SlotBindingsDto } from './upsert-outreach-config.dto';

/** PUT /tenant: cria config operacional sem preço (costPerLead/cashbackOnReply = 0). */
export class UpsertTenantOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Habilitar outreach', default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'FK do template de outreach no catálogo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  outreachTemplateId?: number;

  @ApiPropertyOptional({ description: 'FK do template de notify no catálogo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  notifyTemplateId?: number;

  @ApiPropertyOptional({ type: SlotBindingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotBindingsDto)
  slotBindings?: SlotBindingsDto;

  @ApiPropertyOptional({
    description: 'Mapa dia-da-semana → horas UTC',
    example: { '2': [18], '3': [18], '4': [13, 18] },
  })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, number[]>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  categories?: string[];

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
