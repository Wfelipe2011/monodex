import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class PatchScrapeTargetDto {
  @ApiPropertyOptional({ description: 'Habilitar ou desabilitar o par cidade×categoria' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Nova categoria (respeita unique cityId+category)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;
}
