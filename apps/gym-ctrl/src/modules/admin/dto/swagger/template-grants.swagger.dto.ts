import { ApiProperty } from '@nestjs/swagger';

export class TemplateGrantTemplateRefDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 'hello_city' })
  name!: string;

  @ApiProperty({ example: 'pt_BR' })
  language!: string;

  @ApiProperty({ example: 'APPROVED' })
  status!: string;
}

export class TemplateGrantResponseDto {
  @ApiProperty({ example: 8 })
  tenantId!: number;

  @ApiProperty({ example: 7 })
  templateId!: number;

  @ApiProperty({ example: '2026-08-18T14:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: TemplateGrantTemplateRefDto })
  template!: TemplateGrantTemplateRefDto;
}

/** Resposta de DELETE (row removida, sem relação template). */
export class TemplateGrantDeletedDto {
  @ApiProperty({ example: 41 })
  id!: number;

  @ApiProperty({ example: 8 })
  tenantId!: number;

  @ApiProperty({ example: 7 })
  templateId!: number;

  @ApiProperty({ example: '2026-08-18T14:00:00.000Z' })
  createdAt!: Date;
}
