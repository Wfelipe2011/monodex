import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Roles } from '@prisma/client';
import { ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantUserDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'maria.admin' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ example: 'maria@academia.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha-segura' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'Roles do usuário do tenant (SUPER_ADMIN não permitido)',
    enum: Roles,
    isArray: true,
    default: [Roles.ADMIN],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Roles, { each: true })
  roles?: Roles[];
}
