import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CityOutreachSendLeadRefDto {
  @ApiProperty({ example: 90 })
  id: number;

  @ApiProperty({ example: 'Academia X' })
  name: string;

  @ApiProperty({ example: '11999999999' })
  phone: string;
}

export class CityOutreachSendResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({
    description: 'ID da mensagem outbound na Meta (wamid)',
    example: 'wamid.xxx',
  })
  wamid: string;

  @ApiProperty({ example: '2026-08-18T20:05:00.000Z' })
  sentAt: Date;

  @ApiPropertyOptional({
    enum: ['sent', 'delivered', 'read', 'failed'],
    example: 'delivered',
    nullable: true,
  })
  lastStatus?: string | null;

  @ApiPropertyOptional({
    description: 'Nome do template no momento do disparo; null em histórico',
    example: 'hello_city',
    nullable: true,
  })
  templateName?: string | null;

  @ApiProperty({ type: CityOutreachSendLeadRefDto })
  lead: CityOutreachSendLeadRefDto;

  @ApiPropertyOptional({
    description: 'Presente quando lastStatus=failed',
    example: { code: 131026, title: 'Message undeliverable' },
  })
  latestError?: unknown;
}
