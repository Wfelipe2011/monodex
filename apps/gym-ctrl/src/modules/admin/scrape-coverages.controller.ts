import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { ScrapeCoveragesService } from './scrape-coverages.service';

@ApiTags('Platform — Scrape')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform/scrape-coverages')
export class ScrapeCoveragesController {
  constructor(
    private readonly scrapeCoveragesService: ScrapeCoveragesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar cobertura de scrape (somente leitura)',
    description:
      'Retorna [] se nunca scrapou. Após um scrape, inclui lastStatus, lastRunAt, lastLeadCount e firstRunAt.',
  })
  @ApiQuery({ name: 'cityId', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  list(
    @Query('cityId', new ParseIntPipe({ optional: true })) cityId?: number,
    @Query('category') category?: string,
  ) {
    return this.scrapeCoveragesService.list(cityId, category);
  }
}
