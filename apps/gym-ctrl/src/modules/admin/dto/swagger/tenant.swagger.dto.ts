import { ApiProperty } from '@nestjs/swagger';

export class TenantResponseDto {
  @ApiProperty({ example: 8 })
  id: number;

  @ApiProperty({ example: 'Construtora XYZ' })
  name: string;

  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID público do tenant',
  })
  uuid: string;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({
    example: false,
    description: 'Grant para emissão/uso de API keys (X-API-KEY)',
  })
  apiAccessEnabled: boolean;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  updatedAt: Date;
}

export class HealthCheckResponseDto {
  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 12345.67 })
  uptime: number;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 'API está funcionando corretamente' })
  message: string;
}

export class PlatformHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'platform' })
  module: string;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  timestamp: string;
}
