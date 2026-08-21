import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOnDemandSendDto {
  @ApiProperty({
    description: 'Telefone de destino (dígitos; 55 será prefixado se faltar)',
    example: '11999999999',
  })
  @IsString()
  @MinLength(1)
  to: string;

  @ApiPropertyOptional({
    description: 'Valores livres por slot key (ex.: body.1)',
    example: { 'body.1': 'João' },
    default: {},
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'publicId da mídia do tenant para header.image (quando o template exige imagem)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  imageId?: string;

  @ApiPropertyOptional({
    description: 'Lead opcional para resolver bindings lead.*',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  leadId?: number;
}
