import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyAllowlist } from '@core/decorators/api-key-allowlist.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import { CreateOnDemandSendDto } from './dto/create-on-demand-send.dto';
import { OnDemandSendCreatedDto } from './dto/swagger/tenant-on-demand.swagger.dto';
import { OnDemandSendsService } from './on-demand-sends.service';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { TemplateGrantsService } from './template-grants.service';

@ApiTags('Tenant — WhatsApp Templates')
@ApiBearerAuth()
@ApiSecurity('X-API-KEY')
@ApiKeyAllowlist()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/whatsapp-templates')
export class TenantTemplatesController {
  constructor(
    private readonly templateGrantsService: TemplateGrantsService,
    private readonly onDemandSendsService: OnDemandSendsService,
  ) {}

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

  @Post(':templateId/sends')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar template granted (on-demand) para número livre',
    description:
      'Usa número dedicado do tenant. Persiste TenantOnDemandSend sem debitar coins. ' +
      'Super Admin sempre 403.',
  })
  @ApiCreatedResponse({
    type: OnDemandSendCreatedDto,
    description:
      'Envio aceito pela Graph (wamid + conversationId). Coins NÃO debitados no 201.',
  })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  createSend(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreateOnDemandSendDto,
    @Req() req: RequestUser,
  ) {
    if (req.user.roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
    rejectSecretTokenFields(req.body);
    return this.onDemandSendsService.create(tenantId, templateId, dto, {
      authKind: req.user.authKind,
      apiKeyId: req.user.apiKeyId,
    });
  }
}
