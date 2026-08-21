import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Nome da chave', example: 'crm-prod' })
  @IsString()
  @MinLength(1)
  name: string;
}
