import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateListLeadDto } from './create-list-lead.dto';

export class BulkCreateListLeadsDto {
  @ApiProperty({
    type: [CreateListLeadDto],
    example: {
      leads: [
        {
          name: 'Construtora ABC',
          phone: '11987654321',
          website: 'https://abc.com.br',
          category: 'Construtoras',
          reviews: 42,
        },
        {
          name: 'Empresa Demo',
          phone: '21999887766',
          category: 'Serviços',
        },
      ],
    },
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateListLeadDto)
  leads: CreateListLeadDto[];
}
