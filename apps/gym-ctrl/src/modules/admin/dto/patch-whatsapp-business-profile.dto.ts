import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Whitelist dos campos Meta aceitos no PATCH de WhatsApp Business Profile.
 * Sempre enviado à Graph com messaging_product=whatsapp (no service).
 */
export class PatchWhatsappBusinessProfileDto {
  @ApiPropertyOptional({
    description: 'Texto "About" do perfil (máx. 139 chars na Meta)',
    maxLength: 139,
  })
  @IsOptional()
  @IsString()
  @MaxLength(139)
  about?: string;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  address?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Até 2 URLs de websites',
    maxItems: 2,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  websites?: string[];

  @ApiPropertyOptional({
    description:
      'Vertical Meta (ex.: OTHER, RETAIL, HEALTH). Ver docs WhatsApp Business Profile.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  vertical?: string;

  @ApiPropertyOptional({
    description:
      'Handle opaco de foto obtido via POST /platform/whatsapp-templates/media',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  profile_picture_handle?: string;
}
