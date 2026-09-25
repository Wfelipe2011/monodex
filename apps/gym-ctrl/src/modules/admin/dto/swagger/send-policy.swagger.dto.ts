import { ApiProperty } from '@nestjs/swagger';

export class SendPolicyResponseDto {
  @ApiProperty({
    type: [Number],
    example: [3, 5],
    description: 'Allowlist de City.id; vazio = sem restrição por allow',
  })
  allowedCityIds!: number[];

  @ApiProperty({
    type: [Number],
    example: [],
    description: 'Denylist de City.id; XOR com allowedCityIds',
  })
  deniedCityIds!: number[];

  @ApiProperty({
    example: false,
    description: 'Respeitar leads já contatados por qualquer tenant',
  })
  respectAllTenants!: boolean;

  @ApiProperty({
    example: false,
    description: 'Modo exclusivo na política de deduplicação',
  })
  exclusive!: boolean;

  @ApiProperty({
    type: [Number],
    example: [2, 4],
    description: 'IDs de tenants cujos envios este tenant deve respeitar',
  })
  respectTenantIds!: number[];
}
