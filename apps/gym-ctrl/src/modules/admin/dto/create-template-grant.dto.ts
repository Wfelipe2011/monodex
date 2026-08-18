import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateTemplateGrantDto {
  @ApiProperty({
    description: 'FK do WhatsappMessageTemplate no catálogo',
    example: 10,
  })
  @IsInt()
  @Min(1)
  templateId: number;
}
