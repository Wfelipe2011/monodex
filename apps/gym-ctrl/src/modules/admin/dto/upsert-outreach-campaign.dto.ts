import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SlotBindingsDto } from './upsert-outreach-config.dto';

/** POST: corpo completo da campanha de prospecção (pool). */
export class UpsertOutreachCampaignDto {
  @ApiProperty({ example: 'Padrão' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  outreachTemplateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  notifyTemplateId?: number;

  @ApiPropertyOptional({ type: SlotBindingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotBindingsDto)
  slotBindings?: SlotBindingsDto;

  @ApiProperty({
    description: 'Mapa dia-da-semana → horas UTC',
    example: { '2': [18], '3': [18], '4': [13, 18] },
  })
  @IsObject()
  schedule: Record<string, number[]>;

  @ApiProperty({ type: [String], example: ['Construtoras'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categories: string[];

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  leadsPerRun?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;

  @ApiPropertyOptional({
    description: 'Filtro opcional de cidade; null = sem filtro extra além da policy',
    nullable: true,
    example: 1,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  cityId?: number | null;
}
