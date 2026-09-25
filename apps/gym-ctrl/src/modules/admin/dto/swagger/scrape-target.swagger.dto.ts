import { ApiProperty } from '@nestjs/swagger';

export class ScrapeTargetCityDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Taubaté' })
  name!: string;

  @ApiProperty({ example: 'SP', nullable: true })
  state!: string | null;
}

export class ScrapeTargetResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 3 })
  cityId!: number;

  @ApiProperty({ example: 'Construtoras' })
  category!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({
    example: true,
    description: 'Flag de plataforma para permitir on-demand neste par',
  })
  onDemandAllowed!: boolean;

  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T17:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: ScrapeTargetCityDto })
  city!: ScrapeTargetCityDto;
}
