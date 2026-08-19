import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitePurpose } from '@prisma/client';

export const INVITE_STATUSES = [
  'PENDING',
  'CONSUMED',
  'REVOKED',
  'EXPIRED',
] as const;

export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const INVITE_ID_PARAM = {
  name: 'inviteId',
  description: 'ID numérico do convite',
  example: 12,
};

export class IssuedInviteResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ enum: InvitePurpose, example: InvitePurpose.FIRST_ADMIN })
  purpose: InvitePurpose;

  @ApiProperty({
    description: 'Token curto em plaintext; só nesta response de criação',
    example: 'A3K7N2PQ',
  })
  token: string;

  @ApiProperty({
    description: 'URL do front para copiar (`{base}/convite/{token}` ou path relativo)',
    example: '/convite/A3K7N2PQ',
  })
  url: string;

  @ApiProperty({ example: '2026-08-19T22:00:00.000Z' })
  expiresAt: Date;
}

export class InviteListItemDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 4 })
  tenantId: number;

  @ApiProperty({ enum: InvitePurpose, example: InvitePurpose.FIRST_ADMIN })
  purpose: InvitePurpose;

  @ApiProperty({ enum: INVITE_STATUSES, example: 'PENDING' })
  status: InviteStatus;

  @ApiProperty({ example: '2026-08-19T22:00:00.000Z' })
  expiresAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  consumedAt?: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revokedAt?: Date | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  createdByUserId?: number | null;

  @ApiProperty({ example: '2026-08-19T14:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-19T14:00:00.000Z' })
  updatedAt: Date;
}
