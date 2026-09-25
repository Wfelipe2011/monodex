import { ApiProperty } from '@nestjs/swagger';
import { Roles } from '@prisma/client';

export class TenantUserResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Maria Admin' })
  name: string;

  @ApiProperty({ example: 'maria.admin' })
  username: string;

  @ApiProperty({ example: 'maria@empresa.com.br' })
  email: string;

  @ApiProperty({ enum: Roles, isArray: true, example: [Roles.ADMIN] })
  roles: Roles[];

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'UUID público do usuário',
  })
  uuid: string;

  @ApiProperty({ example: 8 })
  tenantId: number;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  updatedAt: Date;
}
