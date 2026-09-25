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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { PlatformJobKey, Roles } from '@prisma/client';
import { PlatformJobSchedulesService } from './platform-job-schedules.service';
import { UpsertPlatformJobScheduleDto } from './dto/upsert-platform-job-schedule.dto';
import { ApiPlatformSuperAdminErrors } from '../../swagger/api-route-errors.decorator';
import { PlatformJobScheduleResponseDto } from './dto/swagger/platform-job-schedules.swagger.dto';

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
    summary:
      'Listar schedules de jobs da plataforma (sync templates, scrape, orphan media, on-demand schedule)',
  })
  @ApiOkResponse({ type: PlatformJobScheduleResponseDto, isArray: true })
  @ApiPlatformSuperAdminErrors()
  list() {
    return this.platformJobSchedulesService.list();
  }

  @Get(':jobKey')
  @ApiOperation({ summary: 'Obter schedule por jobKey' })
  @ApiParam({ name: 'jobKey', enum: PlatformJobKey })
  @ApiOkResponse({ type: PlatformJobScheduleResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'PlatformJobSchedule não encontrado para o jobKey informado',
    badRequest: 'jobKey inválido (enum PlatformJobKey)',
  })
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
      'jobKey deve ser um valor de PlatformJobKey (ex.: WHATSAPP_TEMPLATE_SYNC, SCRAPE, ORPHAN_MEDIA_CLEANUP, ON_DEMAND_SCHEDULE_RUN). Workers fazem poll; PUT não notifica processos.',
  })
  @ApiParam({ name: 'jobKey', enum: PlatformJobKey })
  @ApiOkResponse({ type: PlatformJobScheduleResponseDto })
  @ApiPlatformSuperAdminErrors({
    badRequest: 'Validação do body ou jobKey inválido',
  })
  upsert(
    @Param('jobKey', new ParseEnumPipe(PlatformJobKey))
    jobKey: PlatformJobKey,
    @Body() dto: UpsertPlatformJobScheduleDto,
  ) {
    return this.platformJobSchedulesService.upsert(jobKey, dto);
  }
}
