import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { CreateTemplateGrantDto } from './dto/create-template-grant.dto';
import { TemplateGrantsService } from './template-grants.service';

@ApiTags('Platform — Template Grants')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/template-grants')
export class TemplateGrantsController {
  constructor(private readonly templateGrantsService: TemplateGrantsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar grants de templates do tenant',
  })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.templateGrantsService.list(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conceder template do catálogo ao tenant (upsert)',
    description:
      'Body `{ templateId }`. Template inexistente → 404. Duplicata no mesmo tenant é idempotente (200). ' +
      'O mesmo templateId pode ser granted a vários tenants.',
  })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateTemplateGrantDto,
  ) {
    return this.templateGrantsService.upsert(tenantId, dto);
  }

  @Put()
  @ApiOperation({
    summary: 'Conceder template do catálogo ao tenant (upsert)',
  })
  upsert(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateTemplateGrantDto,
  ) {
    return this.templateGrantsService.upsert(tenantId, dto);
  }

  @Delete(':templateId')
  @ApiOperation({
    summary: 'Revogar grant de um template',
  })
  remove(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('templateId', ParseIntPipe) templateId: number,
  ) {
    return this.templateGrantsService.remove(tenantId, templateId);
  }
}
