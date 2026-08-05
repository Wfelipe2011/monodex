import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
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
}
