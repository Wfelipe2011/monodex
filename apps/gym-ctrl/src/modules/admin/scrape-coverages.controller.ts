import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ScrapeCoverageItemDto } from './dto/swagger/scrape-coverage.swagger.dto';
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
      'Retorna [] se nunca scrapou. Inclui lastStatus, lastRunAt, lastLeadCount, firstRunAt, ' +
      'schedulePhase, nextScheduledRunAt, scheduledRunCount e lastRunKind.',
  })
  @ApiOkResponse({ type: ScrapeCoverageItemDto, isArray: true })
  @ApiQuery({ name: 'cityId', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  list(
    @Query('cityId', new ParseIntPipe({ optional: true })) cityId?: number,
    @Query('category') category?: string,
  ) {
    return this.scrapeCoveragesService.list(cityId, category);
  }
}
