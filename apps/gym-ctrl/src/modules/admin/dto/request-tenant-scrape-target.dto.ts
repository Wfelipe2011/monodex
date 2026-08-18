import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RequestTenantScrapeTargetDto {
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
}
