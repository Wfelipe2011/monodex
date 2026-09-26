import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const OUTREACH_CAMPAIGN_ID_PARAM = {
  name: 'campaignId',
  description: 'ID da campanha de prospecção (pool)',
  example: 3,
};

export class OutreachCampaignTemplateRefDto {
  @ApiProperty({ example: 10 })
  id!: number;

  @ApiProperty({ example: 'outreach_v1' })
  name!: string;

  @ApiProperty({ example: 'pt_BR' })
  language!: string;

  @ApiProperty({ example: 'APPROVED' })
  status!: string;
}

export class OutreachCampaignResponseDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 8 })
  tenantId!: number;

  @ApiProperty({ example: 'Padrão' })
  name!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({
    example: { '2': [18], '4': [13] },
  })
  schedule!: Record<string, unknown>;

  @ApiProperty({ type: [String], example: ['Construtoras'] })
  categories!: string[];

  @ApiProperty({ example: 5 })
  leadsPerRun!: number;

  @ApiProperty({ example: 5 })
  sendIntervalSeconds!: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  outreachTemplateId?: number | null;

  @ApiPropertyOptional({ example: 11, nullable: true })
  notifyTemplateId?: number | null;

  @ApiProperty({
    description: 'Bindings persistidos (outreach / notify)',
    example: {
      outreach: { 'body.1': { type: 'literal', value: 'Acme' } },
      notify: {},
    },
  })
  slotBindings!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 1, nullable: true })
  cityId?: number | null;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: OutreachCampaignTemplateRefDto, nullable: true })
  outreachTemplate?: OutreachCampaignTemplateRefDto | null;

  @ApiPropertyOptional({ type: OutreachCampaignTemplateRefDto, nullable: true })
  notifyTemplate?: OutreachCampaignTemplateRefDto | null;
}
