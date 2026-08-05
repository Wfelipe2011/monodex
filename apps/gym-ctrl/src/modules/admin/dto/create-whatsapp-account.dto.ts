import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateWhatsappAccountDto {
  @ApiProperty({ description: 'Meta Cloud API phone_number_id', example: '688645744332614' })
  @IsString()
  @MinLength(1)
  phoneNumberId: string;

  @ApiPropertyOptional({ description: 'Telefone de exibição', example: '+5511999998888' })
  @IsOptional()
  @IsString()
  displayPhone?: string;

  @ApiPropertyOptional({
    description: 'Nome da env var com o token Meta (nunca o token em si)',
    default: 'WHATSAPP_TOKEN',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  tokenEnvKey?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Apenas null permitido; não-nulo → 400 no service. */
  @ApiPropertyOptional({
    description: 'Deve ser null/omitido (somente contas de plataforma no MVP)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  tenantId?: number | null;
}
