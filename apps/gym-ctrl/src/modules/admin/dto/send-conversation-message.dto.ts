import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendConversationMessageDto {
  @ApiProperty({
    description: 'Texto livre (janela Meta 24h após último inbound)',
    example: 'Olá! Como posso ajudar?',
    maxLength: 4096,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text: string;
}
