import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class PatchListCostDto {
  @ApiProperty({
    description: 'Custo por envio (0 = campanha não envia)',
    example: 0.4,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  costPerSend: number;
}
