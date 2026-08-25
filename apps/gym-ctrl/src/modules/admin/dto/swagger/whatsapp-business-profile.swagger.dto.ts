import { ApiPropertyOptional } from '@nestjs/swagger';

/** Shape plano devolvido por GET/PATCH business-profile (proxy Graph; sem token). */
export class WhatsappBusinessProfileResponseDto {
  @ApiPropertyOptional({
    example: 'Atendimento WhatsApp da plataforma',
    description: 'Texto About (máx. 139 chars na Meta)',
  })
  about?: string;

  @ApiPropertyOptional({ example: 'Av. Exemplo 100, São Paulo' })
  address?: string;

  @ApiPropertyOptional({
    example: 'Canal oficial de comunicação com clientes do tenant',
  })
  description?: string;

  @ApiPropertyOptional({ example: 'contato@example.com' })
  email?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com'],
  })
  websites?: string[];

  @ApiPropertyOptional({ example: 'OTHER' })
  vertical?: string;

  @ApiPropertyOptional({
    description: 'URL pública da foto quando a Graph a devolve',
    example: 'https://lookaside.fbsbx.com/…',
  })
  profile_picture_url?: string;
}
