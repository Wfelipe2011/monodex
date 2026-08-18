import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PatchTenantPhoneDto {
  @ApiProperty({
    description: 'Telefone do tenant (não altera active)',
    example: '12911112222',
  })
  @IsString()
  @MinLength(1)
  phone: string;
}
