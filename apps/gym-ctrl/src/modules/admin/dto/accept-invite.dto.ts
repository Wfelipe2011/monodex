import { ApiProperty } from '@nestjs/swagger';
import { InvitePurpose } from '@prisma/client';
import { IsEmail, IsString, MinLength } from 'class-validator';

export const PUBLIC_INVITE_TOKEN_PARAM = {
  name: 'token',
  description: 'Token curto de 8 caracteres em plaintext (não o hash)',
  example: 'A3K7N2PQ',
};

export class AcceptInviteDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'maria.admin' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ example: 'maria@academia.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha-segura' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class PreviewInviteResponseDto {
  @ApiProperty({ enum: InvitePurpose, example: InvitePurpose.FIRST_ADMIN })
  purpose: InvitePurpose;

  @ApiProperty({ example: 'Academia Centro' })
  tenantName: string;

  @ApiProperty({
    description: 'ID do tenant do convite (útil para o front montar a home)',
    example: 4,
  })
  tenantId: number;

  @ApiProperty({ example: '2026-08-19T22:00:00.000Z' })
  expiresAt: Date;
}
