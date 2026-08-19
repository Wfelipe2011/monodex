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
  @IsInt()
  id: number;

  @IsString()
  wamid: string;

  @Equals('IN')
  direction: 'IN';

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsString()
  phone: string;

  @IsISO8601()
  createdAt: string;
}

export class InboxInboundEventDto {
  @Equals('message.inbound')
  type: 'message.inbound';

  @IsInt()
  tenantId: number;

  @IsInt()
  conversationId: number;

  @IsString()
  displayName: string;

  @ValidateNested()
  @Type(() => InboundMessageDto)
  message: InboundMessageDto;
}
