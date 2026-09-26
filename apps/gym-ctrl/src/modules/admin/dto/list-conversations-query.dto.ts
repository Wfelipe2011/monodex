import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description:
      'Busca case-insensitive em displayName ou substring do telefone',
    example: 'maria',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtra threads cujo último envio pool foi desta campanha',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  outreachCampaignId?: number;

  @ApiPropertyOptional({
    description: 'Filtra pelo templateName do último envio pool na thread',
    example: 'hello_city',
  })
  @IsOptional()
  @IsString()
  templateName?: string;
}
