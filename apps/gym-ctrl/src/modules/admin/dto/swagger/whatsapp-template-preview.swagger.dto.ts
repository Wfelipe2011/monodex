import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Slot estável para o front substituir placeholders client-side. */
export class WhatsappTemplateSlotDto {
  @ApiProperty({ example: 'body.1' })
  key: string;

  @ApiProperty({ enum: ['header', 'body', 'button'], example: 'body' })
  component: 'header' | 'body' | 'button';

  @ApiProperty({ enum: ['image', 'text'], example: 'text' })
  paramType: 'image' | 'text';

  @ApiPropertyOptional({
    enum: ['positional', 'named'],
    example: 'positional',
  })
  format?: 'positional' | 'named';

  @ApiPropertyOptional({ example: 1 })
  index?: number;

  @ApiPropertyOptional({ example: 'customer_name' })
  parameterName?: string;

  @ApiPropertyOptional({ enum: ['url'], example: 'url' })
  subType?: 'url';
}

/**
 * Preview de template (platform + tenant granted).
 * O backend NÃO interpola `{{n}}` — o cliente usa `slots` + mapa de variáveis.
 */
export class WhatsappTemplatePreviewDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiPropertyOptional({
    nullable: true,
    example: '4578906895724819',
    description: 'ID Meta do template; null se ainda não sincronizado',
  })
  metaId: string | null;

  @ApiProperty({ example: 'lembrete_pagamento_vencido' })
  name: string;

  @ApiProperty({ example: 'pt_BR' })
  language: string;

  @ApiProperty({
    example: 'APPROVED',
    description: 'Status Meta (ex. PENDING após create, APPROVED após sync)',
  })
  status: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'MARKETING',
  })
  category: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'POSITIONAL',
  })
  parameterFormat: string | null;

  @ApiProperty({
    type: [WhatsappTemplateSlotDto],
    description: 'Slots parseados; keys estáveis (body.1, header.image, …)',
  })
  slots: WhatsappTemplateSlotDto[];

  @ApiProperty({
    description:
      'Components no shape Meta (HEADER/BODY/FOOTER/BUTTONS). TEXT com placeholders {{1}}; preview é client-side.',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    example: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Pagamento pendente',
      },
      {
        type: 'BODY',
        text: 'Olá, {{1}}! Seu pagamento vence em {{2}}. Regularize para manter o acesso.',
        example: {
          body_text: [['João', '30/08']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Mensagem automática',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Pagar agora',
            url: 'https://example.com/pay/{{1}}',
            example: ['abc123'],
          },
        ],
      },
    ],
  })
  components: Record<string, unknown>[];

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z' })
  lastSyncedAt: Date | string;
}

/** Resposta de DELETE /platform/whatsapp-templates/:id (sucesso). */
export class WhatsappTemplateDeletedDto {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({ example: 12 })
  id: number;
}
