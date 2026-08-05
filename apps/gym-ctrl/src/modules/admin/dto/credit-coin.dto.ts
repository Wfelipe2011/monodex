import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoinTransactionType } from '@prisma/client';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

const CREDIT_TYPES = [CoinTransactionType.CREDITO, CoinTransactionType.BONUS] as const;

export class CreditCoinDto {
  @ApiProperty({ description: 'User do tenant que receberá o crédito', example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ description: 'Valor positivo a creditar', example: 10 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Descrição livre (marcador do operador é anexado)', example: 'Credito inicial onboarding' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional({
    description: 'Tipo da transaction (default CREDITO)',
    enum: CREDIT_TYPES,
    default: CoinTransactionType.CREDITO,
  })
  @IsOptional()
  @IsIn(CREDIT_TYPES)
  type?: (typeof CREDIT_TYPES)[number];
}
