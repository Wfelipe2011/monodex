import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationMessageResponseDto } from './tenant-list.swagger.dto';

export const CONVERSATION_ID_PARAM = {
  name: 'conversationId',
  description: 'ID da thread de conversa do tenant',
  example: 88,
};

export class ConversationLastMessageDto {
  @ApiProperty({ example: 501 })
  id: number;

  @ApiProperty({ enum: ['IN', 'OUT'], example: 'IN' })
  direction: string;

  @ApiProperty({
    example: 'text',
    description: 'text | button | image | …',
  })
  type: string;

  @ApiPropertyOptional({
    example: 'Tenho Interesse!',
    nullable: true,
  })
  body?: string | null;

  @ApiProperty({ example: '2026-08-17T20:10:00.000Z' })
  createdAt: Date;
}

export class ConversationThreadResponseDto {
  @ApiProperty({ example: 88 })
  id: number;

  @ApiProperty({
    description: 'Telefone normalizado da thread',
    example: '5511987654321',
  })
  phone: string;

  @ApiProperty({ example: 'Maria' })
  displayName: string;

  @ApiProperty({ example: '2026-08-19T12:00:00.000Z' })
  lastMessageAt: Date;

  @ApiPropertyOptional({
    example: '2026-08-19T11:50:00.000Z',
    nullable: true,
  })
  lastInboundAt?: Date | null;

  @ApiProperty({
    description: 'true quando lastInboundAt está dentro das últimas 24h',
    example: true,
  })
  windowOpen: boolean;

  @ApiPropertyOptional({
    type: ConversationLastMessageDto,
    nullable: true,
  })
  lastMessage?: ConversationLastMessageDto | null;
}

export { ConversationMessageResponseDto };
