import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { ScrapeTargetsService } from './scrape-targets.service';
import { CreateScrapeTargetDto } from './dto/create-scrape-target.dto';
import { PatchScrapeTargetDto } from './dto/patch-scrape-target.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';

@ApiTags('Platform — Scrape')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/scrape-targets')
export class ScrapeTargetsController {
  constructor(private readonly scrapeTargetsService: ScrapeTargetsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar scrape targets (cidade × categoria)' })
  list() {
    return this.scrapeTargetsService.list();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Criar ou upsert scrape target',
    description:
      'Resolve/cria City por nome (e state se enviado). Upsert no par cityId+category. Não dispara scrape.',
  })
  create(@Body() dto: CreateScrapeTargetDto, @Req() req: Request) {
    rejectSecretTokenFields(req.body);
    return this.scrapeTargetsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter scrape target por id' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.scrapeTargetsService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar scrape target',
    description: 'enabled=false faz o cron pular o par. category colidindo → 409.',
  })
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchScrapeTargetDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.scrapeTargetsService.patch(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover scrape target',
    description: 'Apaga só o target. City, Neighborhood e ScrapeCoverage permanecem.',
  })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.scrapeTargetsService.delete(id);
  }
}
