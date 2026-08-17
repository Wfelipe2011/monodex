import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListLeadDto {
  @ApiProperty({ description: 'Nome do lead', example: 'Construtora ABC' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Telefone (normalizado para dígitos com prefixo 55)',
    example: '(11) 98765-4321',
  })
  @IsString()
  @MinLength(1)
  phone: string;

  @ApiPropertyOptional({ description: 'Site', example: 'https://example.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Categoria', example: 'Construtoras' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Quantidade de reviews (≥ 0)', example: 42 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reviews?: number;
}
