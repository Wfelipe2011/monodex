import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class DebitCoinDto {
  @ApiProperty({ description: 'User do tenant a debitar', example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ description: 'Valor positivo a debitar', example: 3 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Descrição livre (marcador do operador é anexado)', example: 'Ajuste operacional' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}
