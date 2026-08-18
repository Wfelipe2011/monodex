import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { PlatformJobKey, Roles } from '@prisma/client';
import { PlatformJobSchedulesService } from './platform-job-schedules.service';
import { UpsertPlatformJobScheduleDto } from './dto/upsert-platform-job-schedule.dto';

@ApiTags('Platform — Job Schedules')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/platform-job-schedules')
export class PlatformJobSchedulesController {
  constructor(
    private readonly platformJobSchedulesService: PlatformJobSchedulesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar schedules de jobs da plataforma (sync templates e scrape)',
  })
  list() {
    return this.platformJobSchedulesService.list();
  }

  @Get(':jobKey')
  @ApiOperation({ summary: 'Obter schedule por jobKey' })
  @ApiParam({ name: 'jobKey', enum: PlatformJobKey })
  getByJobKey(
    @Param('jobKey', new ParseEnumPipe(PlatformJobKey))
    jobKey: PlatformJobKey,
  ) {
    return this.platformJobSchedulesService.getByJobKey(jobKey);
  }

  @Put(':jobKey')
  @ApiOperation({
    summary: 'Atualizar (upsert) cron, timezone e enabled de um job da plataforma',
    description:
      'jobKey deve ser WHATSAPP_TEMPLATE_SYNC ou SCRAPE. Workers fazem poll; PUT não notifica processos.',
  })
  @ApiParam({ name: 'jobKey', enum: PlatformJobKey })
  upsert(
    @Param('jobKey', new ParseEnumPipe(PlatformJobKey))
    jobKey: PlatformJobKey,
    @Body() dto: UpsertPlatformJobScheduleDto,
  ) {
    return this.platformJobSchedulesService.upsert(jobKey, dto);
  }
}
