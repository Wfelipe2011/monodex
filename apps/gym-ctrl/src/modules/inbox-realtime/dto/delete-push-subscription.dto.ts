import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeletePushSubscriptionDto {
  @ApiProperty({
    description: 'Endpoint da subscription a remover',
    example: 'https://fcm.googleapis.com/fcm/send/abc123',
  })
  @IsString()
  endpoint: string;
}
