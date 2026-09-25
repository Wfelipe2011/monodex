import { ApiProperty } from '@nestjs/swagger';
import { CoinTransactionType } from '@prisma/client';

export class CoinBalanceResponseDto {
  @ApiProperty({ example: 12 })
  userId: number;

  @ApiProperty({ example: 150.5 })
  balance: number;

  @ApiProperty({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'UUID da carteira de coins',
  })
  uuid: string;
}

export class CoinTransactionResponseDto {
  @ApiProperty({ example: 901 })
  id: number;

  @ApiProperty({ example: 12 })
  userId: number;

  @ApiProperty({ example: 8 })
  tenantId: number;

  @ApiProperty({ example: 25.0 })
  amount: number;

  @ApiProperty({ enum: CoinTransactionType, example: CoinTransactionType.CREDITO })
  type: CoinTransactionType;

  @ApiProperty({
    example: 'Crédito manual | bySuperAdmin:1',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: null, nullable: true })
  leadId: number | null;
}

export class CoinMutationResponseDto {
  @ApiProperty({ type: CoinBalanceResponseDto })
  coin: CoinBalanceResponseDto;

  @ApiProperty({ type: CoinTransactionResponseDto })
  transaction: CoinTransactionResponseDto;
}
