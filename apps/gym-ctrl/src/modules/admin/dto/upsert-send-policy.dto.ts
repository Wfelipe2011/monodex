import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class UpsertSendPolicyDto {
  @ApiProperty({
    description: 'Allowlist de city ids (XOR com deniedCityIds)',
    type: [Number],
    example: [1],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  allowedCityIds: number[];

  @ApiProperty({
    description: 'Denylist de city ids (XOR com allowedCityIds)',
    type: [Number],
    example: [],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  deniedCityIds: number[];

  @ApiProperty({
    description: 'Excluir telefones contacted=true de qualquer outro tenant',
    example: false,
  })
  @IsBoolean()
  respectAllTenants: boolean;

  @ApiProperty({
    description:
      'Outros tenants excluem telefones que este tenant contactou',
    example: false,
  })
  @IsBoolean()
  exclusive: boolean;

  @ApiProperty({
    description:
      'Tenant ids respeitados (não pode incluir o próprio tenantId)',
    type: [Number],
    example: [2, 3],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  respectTenantIds: number[];
}
