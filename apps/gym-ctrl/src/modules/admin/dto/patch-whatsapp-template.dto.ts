import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { WHATSAPP_TEMPLATE_MVP_CATEGORY } from './create-whatsapp-template.dto';

/**
 * Edição Meta é full replace de components. name e language NÃO podem
 * ser alterados via API (Meta não permite) — se enviados no body, a rota
 * responde 400 antes de chegar ao Graph.
 */
export class PatchWhatsappTemplateDto {
  @ApiProperty({
    description:
      'Components completos (replace Meta). Mesmas regras de validação do create. Inclua BODY.text com placeholders.',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    example: [
      {
        type: 'BODY',
        text: 'Olá, {{1}}! Oferta atualizada até {{2}}.',
        example: { body_text: [['João', '31/08']] },
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  components: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: 'Categoria — MVP somente MARKETING',
    enum: [WHATSAPP_TEMPLATE_MVP_CATEGORY],
  })
  @IsOptional()
  @IsString()
  @IsIn([WHATSAPP_TEMPLATE_MVP_CATEGORY], {
    message: 'category deve ser MARKETING no MVP',
  })
  category?: typeof WHATSAPP_TEMPLATE_MVP_CATEGORY;
}
