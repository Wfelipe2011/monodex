import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class PatchLeadListDto {
  @ApiPropertyOptional({
    description: 'Nome da lista',
    example: 'Construtoras SP — Q3',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
