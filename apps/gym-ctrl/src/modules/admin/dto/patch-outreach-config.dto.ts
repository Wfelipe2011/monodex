import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { SlotBindingsDto } from './upsert-outreach-config.dto';

/** PATCH: parcial — só campos enviados. */
export class PatchOutreachConfigDto {
  @ApiPropertyOptional({ description: 'Habilitar outreach' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Custo em coins por lead contatado' })
  @IsOptional()
  @IsNumber()
  costPerLead?: number;

  @ApiPropertyOptional({ description: 'Cashback ao receber reply' })
  @IsOptional()
  @IsNumber()
  cashbackOnReply?: number;

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
  @ArrayMinSize(1)
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Leads contactados por execução',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  leadsPerRun?: number;

  @ApiPropertyOptional({
    description: 'Intervalo em segundos entre envios',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;
}
