import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PatchWhatsappAccountDto {
  @ApiPropertyOptional({ description: 'Meta Cloud API phone_number_id' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  phoneNumberId?: string;

  @ApiPropertyOptional({ description: 'WhatsApp Business Account ID (WABA)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  wabaId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  displayPhone?: string | null;

  @ApiPropertyOptional({
    description: 'Nome da env var com o token Meta (nunca o token em si)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  tokenEnvKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Se true, promove esta conta a default e desmarca a anterior na mesma transação. false na única default é recusado.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** Apenas null permitido; não-nulo → 400 no service. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  tenantId?: number | null;
}
