import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeletePushSubscriptionDto {
  @ApiProperty({ description: 'Endpoint da subscription a remover' })
  @IsString()
  endpoint: string;
}
