import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateLeadListDto {
  @ApiProperty({ description: 'Nome da lista', example: 'Construtoras SP' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Custo por envio (deve ser > 0)',
    example: 1.5,
  })
  @IsNumber()
  @Min(0.000001)
  costPerSend: number;
}
