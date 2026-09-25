import { ApiProperty } from '@nestjs/swagger';
import { PlatformJobKey } from '@prisma/client';

export class PlatformJobScheduleResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({
    enum: PlatformJobKey,
    example: PlatformJobKey.WHATSAPP_TEMPLATE_SYNC,
  })
  jobKey: PlatformJobKey;

  @ApiProperty({ example: '0 */6 * * *' })
  cronExpression: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timeZone: string;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  updatedAt: Date;
}
