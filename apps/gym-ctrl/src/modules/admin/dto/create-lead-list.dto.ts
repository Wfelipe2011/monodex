import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateLeadListDto {
  @ApiProperty({ description: 'Nome da lista', example: 'Construtoras SP' })
  @IsString()
  @MinLength(1)
  name: string;
}
