import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import { TemplateGrantsService } from './template-grants.service';

@ApiTags('Tenant — WhatsApp Templates')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/whatsapp-templates')
export class TenantTemplatesController {
  constructor(private readonly templateGrantsService: TemplateGrantsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar templates granted ao tenant',
    description:
      'Join grant + catálogo: id, name, language, status, slots. Sem sync Graph. ' +
      'Templates do catálogo sem grant são omitidos.',
  })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.templateGrantsService.listGrantedTemplates(tenantId);
  }
}
