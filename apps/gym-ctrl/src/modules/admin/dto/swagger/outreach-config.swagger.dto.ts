import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoinDebitOnStatus } from '@prisma/client';

export class ResolvedWhatsappAccountDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: '123456789012345' })
  phoneNumberId!: string;

  @ApiProperty({ example: '+55 12 98888-7777', nullable: true })
  displayPhone!: string | null;

  @ApiProperty({ example: false })
  isDefault!: boolean;
}

export class TenantOutreachConfigResponseDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 8 })
  tenantId!: number;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 0.35 })
  costPerLead!: number;

  @ApiProperty({ example: 1.2 })
  costPerOnDemandSend!: number;

  @ApiProperty({ example: 0.1 })
  cashbackOnReply!: number;

  @ApiProperty({ enum: CoinDebitOnStatus, example: 'delivered' })
  coinDebitOnStatus!: CoinDebitOnStatus;

  @ApiPropertyOptional({ example: 3, nullable: true })
  whatsappAccountId?: number | null;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    type: ResolvedWhatsappAccountDto,
    nullable: true,
    description: 'Conta atribuída ou default da plataforma quando FK é null',
  })
  resolvedWhatsappAccount?: ResolvedWhatsappAccountDto | null;

  @ApiPropertyOptional({
    description: 'Número de campanhas de prospecção do tenant',
    example: 2,
  })
  campaignCount?: number;
}
