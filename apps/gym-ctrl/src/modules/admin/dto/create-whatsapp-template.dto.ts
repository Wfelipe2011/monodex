import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/** MVP: somente MARKETING. */
export const WHATSAPP_TEMPLATE_MVP_CATEGORY = 'MARKETING' as const;

export class CreateWhatsappTemplateDto {
  @ApiProperty({
    description:
      'Nome do template (somente minúsculas, números e underscore)',
    example: 'promo_boas_vindas',
  })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name deve conter apenas a-z, 0-9 e underscore',
  })
  name: string;

  @ApiProperty({
    description: 'Código de idioma Meta (ex. pt_BR)',
    example: 'pt_BR',
  })
  @IsString()
  @Matches(/^[a-z]{2}(_[A-Z]{2})?$/, {
    message: 'language deve ser um locale Meta válido (ex. pt_BR)',
  })
  language: string;

  @ApiProperty({
    description: 'Categoria Meta — MVP aceita somente MARKETING',
    enum: [WHATSAPP_TEMPLATE_MVP_CATEGORY],
    example: WHATSAPP_TEMPLATE_MVP_CATEGORY,
  })
  @IsString()
  @IsIn([WHATSAPP_TEMPLATE_MVP_CATEGORY], {
    message: 'category deve ser MARKETING no MVP',
  })
  category: typeof WHATSAPP_TEMPLATE_MVP_CATEGORY;

  @ApiPropertyOptional({
    description: 'Formato de parâmetros Meta',
    enum: ['POSITIONAL', 'NAMED'],
    example: 'POSITIONAL',
  })
  @IsOptional()
  @IsString()
  @IsIn(['POSITIONAL', 'NAMED'])
  parameterFormat?: 'POSITIONAL' | 'NAMED';

  @ApiProperty({
    description:
      'Components no shape Meta (HEADER TEXT|IMAGE, BODY, FOOTER?, BUTTONS?). Variáveis exigem example; HEADER IMAGE exige header_handle.',
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
        example: { body_text: [['João', '30/08']] },
      },
      {
        type: 'FOOTER',
        text: 'Mensagem automática',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  components: Record<string, unknown>[];
}
