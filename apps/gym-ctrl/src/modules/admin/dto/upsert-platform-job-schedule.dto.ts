import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Cron Unix de 5 campos (minuto hora dia mês weekday). */
const FIVE_FIELD_CRON = /^(\S+\s+){4}\S+$/;

export class UpsertPlatformJobScheduleDto {
  @ApiProperty({
    description: 'Expressão cron de 5 campos',
    example: '0 8 * * *',
  })
  @IsString()
  @MinLength(1)
  @Matches(FIVE_FIELD_CRON, {
    message: 'cronExpression deve ter exatamente 5 campos (ex.: "0 8 * * *")',
  })
  cronExpression: string;

  @ApiPropertyOptional({
    description: 'Timezone IANA',
    default: 'America/Sao_Paulo',
    example: 'America/Sao_Paulo',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  timeZone?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
