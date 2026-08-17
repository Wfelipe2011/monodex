import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class PatchListLeadDto {
  @ApiPropertyOptional({
    description: 'Nome do lead',
    example: 'Construtora ABC Ltda',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description: 'Telefone (será normalizado)',
    example: '11987654321',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Site',
    example: 'https://exemplo.com.br',
  })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({
    description: 'Categoria livre',
    example: 'Construtoras',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Quantidade de reviews (≥ 0)',
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  reviews?: number;
}
