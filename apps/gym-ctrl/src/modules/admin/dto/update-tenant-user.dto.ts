import { ApiPropertyOptional } from '@nestjs/swagger';
import { Roles } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTenantUserDto {
  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description: 'Roles do usuário do tenant (SUPER_ADMIN não permitido)',
    enum: Roles,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Roles, { each: true })
  roles?: Roles[];
}
