import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({
    description: 'Chave p256dh da PushSubscription do browser',
    example: 'BNcRd…base64url…',
  })
  @IsString()
  p256dh: string;

  @ApiProperty({
    description: 'Chave auth da PushSubscription do browser',
    example: 'tBHIt…base64url…',
  })
  @IsString()
  auth: string;
}

export class UpsertPushSubscriptionDto {
  @ApiProperty({
    description: 'Endpoint único retornado pelo PushManager.subscribe()',
    example: 'https://fcm.googleapis.com/fcm/send/abc123',
  })
  @IsString()
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}
