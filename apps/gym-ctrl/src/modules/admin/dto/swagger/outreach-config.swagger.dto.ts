import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoinDebitOnStatus } from '@prisma/client';

export class OutreachConfigTemplateRefDto {
  @ApiProperty({ example: 10 })
  id!: number;

  @ApiProperty({ example: 'outreach_v1' })
  name!: string;

  @ApiProperty({ example: 'pt_BR' })
  language!: string;

  @ApiProperty({ example: 'APPROVED' })
  status!: string;
}

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

  @ApiPropertyOptional({ example: 10, nullable: true })
  outreachTemplateId?: number | null;

  @ApiPropertyOptional({ example: 11, nullable: true })
  notifyTemplateId?: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  whatsappAccountId?: number | null;

  @ApiProperty({
    description: 'Bindings persistidos (outreach / notify)',
    example: {
      outreach: { 'body.1': { type: 'literal', value: 'Acme' } },
      notify: {},
    },
  })
  slotBindings!: Record<string, unknown>;

  @ApiProperty({
    example: { days: ['MON', 'WED'], startHour: 9, endHour: 18 },
  })
  schedule!: Record<string, unknown>;

  @ApiProperty({ type: [String], example: ['Construtoras'] })
  categories!: string[];

  @ApiProperty({ example: 5 })
  leadsPerRun!: number;

  @ApiProperty({ example: 5 })
  sendIntervalSeconds!: number;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: OutreachConfigTemplateRefDto, nullable: true })
  outreachTemplate?: OutreachConfigTemplateRefDto | null;

  @ApiPropertyOptional({ type: OutreachConfigTemplateRefDto, nullable: true })
  notifyTemplate?: OutreachConfigTemplateRefDto | null;

  @ApiPropertyOptional({
    type: ResolvedWhatsappAccountDto,
    nullable: true,
    description: 'Conta atribuída ou default da plataforma quando FK é null',
  })
  resolvedWhatsappAccount?: ResolvedWhatsappAccountDto | null;
}
