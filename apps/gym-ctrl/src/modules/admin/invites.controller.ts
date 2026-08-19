import {
  Controller,
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
import { InvitePurpose, Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { InvitesService } from './invites.service';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import {
  InviteListItemDto,
  INVITE_ID_PARAM,
  IssuedInviteResponseDto,
} from './dto/invite-response.dto';

@ApiTags('Platform — Tenant Invites')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @ApiOperation({
    summary: 'Emitir convite FIRST_ADMIN (claim, sem identidade)',
    description:
      'Body vazio. Só se o tenant ainda não tiver users (409 se já tiver). ' +
      'Revoga o FIRST_ADMIN pendente anterior. O token plaintext sai só nesta response.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({ type: IssuedInviteResponseDto })
  @ApiConflictResponse({ description: 'Tenant já possui usuários' })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  issue(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Req() req: RequestUser,
  ) {
    return this.invitesService.issueFirstAdmin(tenantId, operatorId(req));
  }

  @Get()
  @ApiOperation({
    summary: 'Listar convites FIRST_ADMIN do tenant (sem token)',
    description:
      'Status derivado: CONSUMED > REVOKED > EXPIRED > PENDING. Sem token nem tokenHash.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({ type: InviteListItemDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.invitesService.listByTenant(tenantId, InvitePurpose.FIRST_ADMIN);
  }

  @Post(':inviteId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar convite FIRST_ADMIN pendente',
    description: '404 se não achar. 409 se já consumido, revogado ou expirado.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(INVITE_ID_PARAM)
  @ApiOkResponse({ type: InviteListItemDto })
  @ApiConflictResponse({ description: 'Convite não está pendente' })
  @ApiNotFoundResponse({ description: 'Tenant ou convite não encontrado' })
  revoke(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.invitesService.revoke(
      tenantId,
      inviteId,
      InvitePurpose.FIRST_ADMIN,
    );
  }
}

@ApiTags('Tenant — Invites')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/invites')
export class TenantInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @ApiOperation({
    summary: 'Emitir convite TENANT_USER (claim, sem identidade)',
    description:
      'Admin do tenant. Super Admin sempre 403. Vários PENDING permitidos. ' +
      'O token plaintext sai só nesta response.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({ type: IssuedInviteResponseDto })
  @ApiForbiddenResponse({
    description: 'Super Admin, tenant inativo ou Admin de outro tenant',
  })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  issue(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Req() req: RequestUser,
  ) {
    return this.invitesService.issueTenantUser(
      tenantId,
      operatorId(req),
      req.user.roles,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar convites TENANT_USER do tenant (sem token)',
    description:
      'Leitura operacional também para Super Admin. Sem token nem tokenHash.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({ type: InviteListItemDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.invitesService.listByTenant(tenantId, InvitePurpose.TENANT_USER);
  }

  @Post(':inviteId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar convite TENANT_USER pendente',
    description: 'Super Admin sempre 403. 404 se não achar. 409 se não-PENDING.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(INVITE_ID_PARAM)
  @ApiOkResponse({ type: InviteListItemDto })
  @ApiForbiddenResponse({
    description: 'Super Admin, tenant inativo ou Admin de outro tenant',
  })
  @ApiConflictResponse({ description: 'Convite não está pendente' })
  @ApiNotFoundResponse({ description: 'Tenant ou convite não encontrado' })
  revoke(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: RequestUser,
  ) {
    return this.invitesService.revoke(
      tenantId,
      inviteId,
      InvitePurpose.TENANT_USER,
      req.user.roles,
    );
  }
}

function operatorId(req: RequestUser): number {
  return req.user.userId ?? req.user.id;
}
