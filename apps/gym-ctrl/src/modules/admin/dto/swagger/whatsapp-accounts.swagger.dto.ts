import { ApiProperty } from '@nestjs/swagger';

/** Conta WhatsApp da plataforma (tenantId null; sem access token). */
export class WhatsappAccountResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CLOUD_API' })
  provider: string;

  @ApiProperty({ example: '123456789012345' })
  phoneNumberId: string;

  @ApiProperty({ example: '987654321098765' })
  wabaId: string;

  @ApiProperty({ example: '+55 11 99999-9999' })
  displayPhone: string;

  @ApiProperty({
    example: 'META_WHATSAPP_TOKEN',
    description: 'Nome da variável de ambiente; nunca o token em si',
  })
  tokenEnvKey: string;

  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Sempre null em contas de plataforma',
  })
  tenantId: number | null;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z' })
  updatedAt: Date;
}
