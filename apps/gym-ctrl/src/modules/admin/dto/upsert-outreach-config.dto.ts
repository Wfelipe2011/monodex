import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** PUT: upsert completo — campos required do Prisma (exceto defaults sensatos). */
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

  @ApiProperty({
    description: 'Texto positional {{1}} do body do template de outreach (quem entra em contato)',
    example: 'Gladson Teixeira (contador em Pindamonhagaba)',
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[^\r\n\t]+$/)
  outreachContactText: string;

  @ApiProperty({ example: 'amigavel' })
  @IsString()
  @MinLength(1)
  outreachTemplateName: string;

  @ApiProperty({ example: 'lembrete_entrar_contato_cliente' })
  @IsString()
  @MinLength(1)
  notifyTenantTemplateName: string;

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
    description: 'URL https da imagem de header do template',
    example: 'https://example.com/header.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  headerImageUrl?: string | null;

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
