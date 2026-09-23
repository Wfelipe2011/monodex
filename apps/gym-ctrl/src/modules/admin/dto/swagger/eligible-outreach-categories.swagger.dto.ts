import { ApiProperty } from '@nestjs/swagger';

/** Par cidade × categoria (ScrapeTarget enabled) visível para o tenant. */
export class EligibleOutreachCategoryItemDto {
  @ApiProperty({
    example: 'Construtoras',
    description:
      'String exata do catálogo (case-sensitive). Use este valor em PATCH/PUT de outreach-config.categories.',
  })
  category!: string;

  @ApiProperty({ example: 3, description: 'ID da cidade (City.id)' })
  cityId!: number;

  @ApiProperty({ example: 'Taubaté', description: 'Nome da cidade' })
  cityName!: string;
}

/** Resposta de GET .../outreach-config/eligible-categories */
export class EligibleOutreachCategoriesResponseDto {
  @ApiProperty({
    type: [String],
    example: ['Clínicas médicas', 'Construtoras'],
    description:
      'Categorias distintas, ordenadas alfabeticamente, deduplicadas a partir de items.',
  })
  categories!: string[];

  @ApiProperty({
    type: [EligibleOutreachCategoryItemDto],
    description:
      'Um item por ScrapeTarget enabled cuja cidade passa na TenantSendPolicy (allow/deny). ' +
      'Inclui targets pedidos por outros tenants na mesma cidade permitida.',
    example: [
      {
        category: 'Construtoras',
        cityId: 3,
        cityName: 'Taubaté',
      },
      {
        category: 'Clínicas médicas',
        cityId: 3,
        cityName: 'Taubaté',
      },
      {
        category: 'Construtoras',
        cityId: 5,
        cityName: 'Sorocaba',
      },
    ],
  })
  items!: EligibleOutreachCategoryItemDto[];
}
