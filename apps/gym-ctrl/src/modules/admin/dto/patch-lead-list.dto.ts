import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class PatchLeadListDto {
  @ApiPropertyOptional({
    description: 'Nome da lista',
    example: 'Construtoras SP — Q3',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description: 'Custo por envio (deve ser > 0)',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  costPerSend?: number;
}
