import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateScrapeTargetDto {
  @ApiProperty({ description: 'Nome da cidade', example: 'Taubaté' })
  @IsString()
  @MinLength(1)
  cityName: string;

  @ApiPropertyOptional({ description: 'UF da cidade', example: 'SP' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  state?: string;

  @ApiProperty({ description: 'Categoria a scrapar', example: 'Construtoras' })
  @IsString()
  @MinLength(1)
  category: string;

  @ApiPropertyOptional({ description: 'Target habilitado para o cron', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
