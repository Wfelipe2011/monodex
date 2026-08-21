import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Nome do tenant' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Telefone E.164 (único)', nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Tenant ativo' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description:
      'Concede acesso à API do tenant (chaves X-API-KEY). Só Super Admin.',
  })
  @IsOptional()
  @IsBoolean()
  apiAccessEnabled?: boolean;
}
