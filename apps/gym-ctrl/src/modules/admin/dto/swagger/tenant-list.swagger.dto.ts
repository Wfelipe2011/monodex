import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Parâmetros comuns nas rotas de listas / campanhas / conversas. */
export const ADMIN_TENANT_ID_PARAM = {
  name: 'tenantId',
  description: 'ID numérico do tenant',
  example: 8,
};

export const LEAD_LIST_ID_PARAM = {
  name: 'listId',
  description: 'ID da lista de leads do tenant',
  example: 1,
};

export const LIST_LEAD_ID_PARAM = {
  name: 'leadId',
  description: 'ID do lead dentro da lista',
  example: 42,
};

export const CAMPAIGN_ID_PARAM = {
  name: 'campaignId',
  description: 'ID da campanha na lista',
  example: 3,
};

export class TenantLeadListResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 8 })
  tenantId: number;

  @ApiProperty({ example: 'Construtoras SP' })
  name: string;

  @ApiProperty({
    description: 'Coins debitados por envio de template nesta lista',
    example: 1.5,
  })
  costPerSend: number;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  updatedAt: Date;
}

export class TenantListLeadResponseDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 1 })
  listId: number;

  @ApiProperty({ example: 'Construtora ABC' })
  name: string;

  @ApiProperty({
    description: 'Telefone normalizado (dígitos, prefixo 55)',
    example: '5511987654321',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'https://exemplo.com.br' })
  website?: string | null;

  @ApiPropertyOptional({ example: 'Construtoras' })
  category?: string | null;

  @ApiPropertyOptional({ example: 42 })
  reviews?: number | null;

  @ApiPropertyOptional({
    description:
      'Campanha que bloqueou o lead após envio aceito; null = elegível',
    example: 3,
  })
  sendLockCampaignId?: number | null;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  updatedAt: Date;
}

export class LeadImportResultDto {
  @ApiProperty({
    description: 'Quantidade de leads criados na operação',
    example: 12,
  })
  created: number;
}

export class CatalogTemplateRefDto {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 'outreach_construtoras' })
  name: string;

  @ApiProperty({ example: 'pt_BR' })
  language: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;
}

export class ListCampaignResponseDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 1 })
  listId: number;

  @ApiProperty({ example: 'Campanha A' })
  name: string;

  @ApiProperty({ example: false })
  enabled: boolean;

  @ApiProperty({ example: 5 })
  templateId: number;

  @ApiProperty({
    description: 'Bindings do template de disparo (role send)',
    example: {
      send: {
        'body.1': { type: 'literal', value: 'Olá' },
        'body.customer_name': { type: 'recipient.name' },
      },
    },
  })
  slotBindings: Record<string, unknown>;

  @ApiPropertyOptional({ example: 6 })
  notifyTemplateId?: number | null;

  @ApiProperty({
    description: 'Bindings do template de notify (role notify)',
    example: {
      notify: {
        'body.customer_name': { type: 'recipient.name' },
        'body.customer_phone': { type: 'recipient.phone' },
      },
    },
  })
  notifySlotBindings: Record<string, unknown>;

  @ApiProperty({
    type: 'array',
    example: [
      { buttonIndex: 0, label: 'Tenho Interesse!', action: 'NOTIFY' },
      { buttonIndex: 1, label: 'Agora não', action: 'NOOP' },
    ],
  })
  buttonActions: Record<string, unknown>[];

  @ApiProperty({
    description: 'Mapa dia-da-semana (0=Dom … 6=Sáb) → horas UTC',
    example: { '2': [18], '4': [13] },
  })
  schedule: Record<string, number[]>;

  @ApiProperty({ example: 5 })
  sendsPerRun: number;

  @ApiProperty({ example: 5 })
  sendIntervalSeconds: number;

  @ApiProperty({ type: CatalogTemplateRefDto })
  template: CatalogTemplateRefDto;

  @ApiPropertyOptional({ type: CatalogTemplateRefDto })
  notifyTemplate?: CatalogTemplateRefDto | null;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-17T20:00:00.000Z' })
  updatedAt: Date;
}

export class ListSendLeadRefDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'Construtora ABC' })
  name: string;

  @ApiProperty({ example: '5511987654321' })
  phone: string;
}

export class ListSendCampaignRefDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Campanha A' })
  name: string;
}

export class ListSendResponseDto {
  @ApiProperty({ example: 100 })
  id: number;

  @ApiProperty({
    description: 'ID da mensagem outbound na Meta (wamid)',
    example: 'wamid.HBgMNTUxMTk4NzY1NDMyMRUCABIYFDN...',
  })
  wamid: string;

  @ApiProperty({ example: '2026-08-17T20:05:00.000Z' })
  sentAt: Date;

  @ApiPropertyOptional({
    enum: ['sent', 'delivered', 'read', 'failed'],
    example: 'delivered',
  })
  lastStatus?: string | null;

  @ApiProperty({ type: ListSendLeadRefDto })
  listLead: ListSendLeadRefDto;

  @ApiProperty({ type: ListSendCampaignRefDto })
  campaign: ListSendCampaignRefDto;

  @ApiPropertyOptional({
    description: 'Presente quando lastStatus=failed',
    example: { code: 131026, title: 'Message undeliverable' },
  })
  latestError?: unknown;
}

export class ConversationMessageResponseDto {
  @ApiProperty({ example: 501 })
  id: number;

  @ApiProperty({
    example: 'wamid.HBgMNTUxMTk4NzY1NDMyMRUCABIYFDN...',
  })
  wamid: string;

  @ApiProperty({ enum: ['IN', 'OUT'], example: 'IN' })
  direction: string;

  @ApiProperty({
    example: 'text',
    description: 'text | button | image | …',
  })
  type: string;

  @ApiPropertyOptional({
    example: 'Tenho Interesse!',
    description: 'Texto ou label do botão quando aplicável',
  })
  body?: string | null;

  @ApiProperty({ example: '2026-08-17T20:10:00.000Z' })
  createdAt: Date;
}
