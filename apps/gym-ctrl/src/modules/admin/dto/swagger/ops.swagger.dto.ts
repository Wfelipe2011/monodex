import { ApiProperty } from '@nestjs/swagger';

export class OpsSummaryResponseDto {
  @ApiProperty({ example: 10 })
  totalTenants: number;

  @ApiProperty({ example: 8 })
  activeTenants: number;

  @ApiProperty({ example: 3 })
  outreachEnabledTenants: number;

  @ApiProperty({
    description: 'Leads no pool global com deletedAt null',
    example: 150,
  })
  totalLeads: number;
}

export class TenantLeadStatsResponseDto {
  @ApiProperty({ example: 12 })
  contacted: number;

  @ApiProperty({ example: 4 })
  replied: number;

  @ApiProperty({ example: 1 })
  quoted: number;

  @ApiProperty({ example: 0 })
  closed: number;

  @ApiProperty({ example: 2 })
  deleted: number;
}

export class LeadCountResponseDto {
  @ApiProperty({
    description: 'Quantidade de Lead com deletedAt null',
    example: 150,
  })
  count: number;
}

export class TenantHomeCoinsResponseDto {
  @ApiProperty({ example: 12.5 })
  balance: number;
}

export class TenantHomeOutreachResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: true })
  hasDedicatedNumber: boolean;

  @ApiProperty({ type: TenantLeadStatsResponseDto })
  cityFunnel: TenantLeadStatsResponseDto;
}

export class TenantHomeInboxResponseDto {
  @ApiProperty({ example: 10 })
  threadCount: number;

  @ApiProperty({ example: 3 })
  openWindows: number;

  @ApiProperty({
    example: '2026-08-19T11:00:00.000Z',
    nullable: true,
  })
  lastInboundAt: string | null;
}

export class TenantHomeSendBucketsResponseDto {
  @ApiProperty({ example: 1 })
  sent: number;

  @ApiProperty({ example: 4 })
  delivered: number;

  @ApiProperty({ example: 2 })
  read: number;

  @ApiProperty({ example: 0 })
  failed: number;

  @ApiProperty({ example: 1 })
  pending: number;

  @ApiProperty({ example: 8 })
  total: number;
}

export class TenantHomeOutreachCampaignSendsResponseDto {
  @ApiProperty({ example: 3 })
  outreachCampaignId: number;

  @ApiProperty({ example: 'Padrão' })
  name: string;

  @ApiProperty({ type: TenantHomeSendBucketsResponseDto })
  today: TenantHomeSendBucketsResponseDto;

  @ApiProperty({ type: TenantHomeSendBucketsResponseDto })
  yesterday: TenantHomeSendBucketsResponseDto;
}

export class TenantHomeSendsResponseDto {
  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone: string;

  @ApiProperty({ type: TenantHomeSendBucketsResponseDto })
  today: TenantHomeSendBucketsResponseDto;

  @ApiProperty({ type: TenantHomeSendBucketsResponseDto })
  yesterday: TenantHomeSendBucketsResponseDto;

  @ApiProperty({
    type: TenantHomeOutreachCampaignSendsResponseDto,
    isArray: true,
    description:
      'Contagem pool (TenantLead com messageId) agrupada por campanha; list sends não entram',
  })
  byOutreachCampaign: TenantHomeOutreachCampaignSendsResponseDto[];
}

export class TenantHomeResponseDto {
  @ApiProperty({ type: TenantHomeCoinsResponseDto })
  coins: TenantHomeCoinsResponseDto;

  @ApiProperty({ type: TenantHomeOutreachResponseDto })
  outreach: TenantHomeOutreachResponseDto;

  @ApiProperty({ type: TenantHomeInboxResponseDto })
  inbox: TenantHomeInboxResponseDto;

  @ApiProperty({ type: TenantHomeSendsResponseDto })
  sends: TenantHomeSendsResponseDto;
}
