import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  outreachTemplateName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  notifyTenantTemplateName?: string;

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
    description: 'URL https da imagem de header do template',
    example: 'https://example.com/header.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  headerImageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Intervalo em segundos entre envios',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sendIntervalSeconds?: number;
}
