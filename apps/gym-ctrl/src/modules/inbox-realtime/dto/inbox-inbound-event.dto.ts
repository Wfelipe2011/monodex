import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class InboundMessageDto {
  @ApiProperty({ example: 501 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'wamid.HBgNNTUxMTk5OTk5OTk5OQ==' })
  @IsString()
  wamid: string;

  @ApiProperty({ enum: ['IN'], example: 'IN' })
  @Equals('IN')
  direction: 'IN';

  @ApiProperty({ example: 'text' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'Olá, tenho interesse!' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ example: '5511987654321' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '2026-08-19T12:00:00.000Z' })
  @IsISO8601()
  createdAt: string;
}

export class InboxInboundEventDto {
  @ApiProperty({ enum: ['message.inbound'], example: 'message.inbound' })
  @Equals('message.inbound')
  type: 'message.inbound';

  @ApiProperty({ example: 8 })
  @IsInt()
  tenantId: number;

  @ApiProperty({ example: 88 })
  @IsInt()
  conversationId: number;

  @ApiProperty({ example: 'Maria' })
  @IsString()
  displayName: string;

  @ApiProperty({ type: InboundMessageDto })
  @ValidateNested()
  @Type(() => InboundMessageDto)
  message: InboundMessageDto;
}
