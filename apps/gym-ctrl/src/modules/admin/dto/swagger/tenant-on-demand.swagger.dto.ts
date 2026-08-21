import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respostas Swagger — API keys, mídia e canal on-demand. */

export class TenantApiKeyListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'crm-prod' })
  name: string;

  @ApiProperty({
    description: 'Prefixo de display (sem secret)',
    example: 'mdx_ab12',
  })
  prefix: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  lastUsedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  revokedAt: Date | null;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z' })
  createdAt: Date;
}

export class TenantApiKeyCreatedDto extends TenantApiKeyListItemDto {
  @ApiProperty({
    description:
      'Plaintext da chave — só neste 201. Guarde imediatamente; listagens não devolvem.',
    example: 'mdx_ab12cd34ef56gh78ij90klmnopqrstuv',
  })
  key: string;
}

export class TenantMediaItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({
    description: 'UUID público (use em imageId e GET /public/media/:publicId)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  publicId: string;

  @ApiProperty({ example: 'banner.png' })
  originalFileName: string;

  @ApiProperty({ example: 'image/png' })
  mimeType: string;

  @ApiProperty({ example: 102400 })
  byteSize: number;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z' })
  createdAt: Date;
}

export class OnDemandSendCreatedDto {
  @ApiProperty({ example: 10 })
  id: number;

  @ApiProperty({ example: 'wamid.HBgNNTUxMTk5OTk5OTk5OQ==' })
  wamid: string;

  @ApiProperty({ example: '5511999999999' })
  to: string;

  @ApiPropertyOptional({ nullable: true, example: 'accepted' })
  messageStatus: string | null;

  @ApiPropertyOptional({ nullable: true, example: 88 })
  conversationId: number | null;
}

export class OnDemandSendStatusDto {
  @ApiProperty({ example: 10 })
  id: number;

  @ApiProperty({ example: 'wamid.HBgNNTUxMTk5OTk5OTk5OQ==' })
  wamid: string;

  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({ example: 3 })
  templateId: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Último status Meta (webhook). null até o 1º status B.',
    enum: ['sent', 'delivered', 'read', 'failed'],
    example: null,
  })
  lastStatus: string | null;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z' })
  sentAt: Date;

  @ApiPropertyOptional({ nullable: true, example: 88 })
  conversationId: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Preenchido só quando lastStatus=failed',
  })
  latestError: unknown;
}

export class OnDemandScheduleDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 8 })
  tenantId: number;

  @ApiProperty({ example: 3 })
  templateId: number;

  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({
    description: 'Início da hora em America/Sao_Paulo (ISO UTC)',
    example: '2026-08-22T17:00:00.000Z',
  })
  scheduledFor: string;

  @ApiProperty({
    enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
    example: 'PENDING',
  })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  failedReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  onDemandSendId: number | null;

  @ApiPropertyOptional({ nullable: true })
  mediaId: number | null;

  @ApiPropertyOptional({ nullable: true })
  leadId: number | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z' })
  createdAt: Date;
}
