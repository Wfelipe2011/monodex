import { DocumentBuilder } from '@nestjs/swagger';
import { HttpErrorResponseDto } from './http-error.swagger';

export const SWAGGER_EXTRA_MODELS = [HttpErrorResponseDto];

export function buildSwaggerDocumentConfig() {
  return new DocumentBuilder()
    .setTitle('Gestão de Leads')
    .setDescription(
      'API para gestão de leads, outreach, templates WhatsApp, inbox e operações de tenant.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-KEY',
        in: 'header',
        description:
          'Chave do tenant (allowlist). Não combine com Authorization Bearer.',
      },
      'X-API-KEY',
    )
    .build();
}
