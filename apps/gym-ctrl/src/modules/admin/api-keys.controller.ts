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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import {
  TenantApiKeyCreatedDto,
  TenantApiKeyListItemDto,
} from './dto/swagger/tenant-on-demand.swagger.dto';

@ApiTags('Tenant — API Keys')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar chaves de API do tenant',
    description:
      'Sem plaintext nem keyHash. Inclui revokedAt e lastUsedAt. Super Admin pode listar. ' +
      'API key (X-API-KEY) não gerencia chaves — fora da allowlist → 401.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: TenantApiKeyListItemDto,
    isArray: true,
    description: 'Chaves do tenant (sem secret)',
  })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.apiKeysService.list(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar chave de API',
    description:
      'Exige apiAccessEnabled. Máximo 3 ativas (revokedAt null). Plaintext só nesta resposta. Super Admin → 403.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({
    type: TenantApiKeyCreatedDto,
    description: 'Chave criada; campo `key` só neste 201',
  })
  @ApiForbiddenResponse({
    description: 'Super Admin, grant off ou tenant inativo',
  })
  @ApiConflictResponse({ description: 'Já existem 3 chaves ativas' })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateApiKeyDto,
    @Req() req: RequestUser,
  ) {
    this.assertTenantAdmin(req);
    return this.apiKeysService.create(tenantId, dto.name);
  }

  @Post(':keyId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar chave de API',
    description:
      'Idempotente se já revogada. Super Admin → 403. Libera slot no teto de 3 ativas.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'keyId', type: Number })
  @ApiOkResponse({
    type: TenantApiKeyListItemDto,
    description: 'Chave revogada (sem secret)',
  })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  @ApiNotFoundResponse({ description: 'Tenant ou chave não encontrada' })
  revoke(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('keyId', ParseIntPipe) keyId: number,
    @Req() req: RequestUser,
  ) {
    this.assertTenantAdmin(req);
    return this.apiKeysService.revoke(tenantId, keyId);
  }

  private assertTenantAdmin(req: RequestUser) {
    if (req.user.roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
  }
}
