import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class TestWhatsappTemplateDto {
  @ApiProperty({
    description: 'Telefone de destino (dígitos; 55 será prefixado se faltar)',
    example: '11999999999',
  })
  @IsString()
  @MinLength(1)
  to: string;

  @ApiPropertyOptional({
    description: 'Valores por slot key (literal ou tipo de binding)',
    example: { 'body.1': 'Demo' },
    default: {},
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Lead opcional para resolver bindings lead.*',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  leadId?: number;

  @ApiPropertyOptional({
    description:
      'Conta plataforma para o envio (phoneNumberId). Omitido usa a default. O template continua no catálogo da default.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  whatsappAccountId?: number;
}
