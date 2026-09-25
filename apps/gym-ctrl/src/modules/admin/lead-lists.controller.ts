import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiOkTextDownloadResponse } from '../../swagger/api-binary-response.decorator';
import {
  ApiPlatformSuperAdminErrors,
  ApiTenantScopedErrors,
} from '../../swagger/api-route-errors.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import type { Response } from 'express';
import { LeadListsService } from './lead-lists.service';
import { CreateLeadListDto } from './dto/create-lead-list.dto';
import { PatchLeadListDto } from './dto/patch-lead-list.dto';
import { PatchListCostDto } from './dto/patch-list-cost.dto';
import { CreateListLeadDto } from './dto/create-list-lead.dto';
import { PatchListLeadDto } from './dto/patch-list-lead.dto';
import { BulkCreateListLeadsDto } from './dto/bulk-create-list-leads.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import {
  ADMIN_TENANT_ID_PARAM,
  LEAD_LIST_ID_PARAM,
  LIST_LEAD_ID_PARAM,
  LeadImportResultDto,
  TenantLeadListResponseDto,
  TenantListLeadResponseDto,
} from './dto/swagger/tenant-list.swagger.dto';

@ApiTags('Tenant — Lead Lists')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/lead-lists')
export class LeadListsController {
  constructor(private readonly leadListsService: LeadListsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar listas de leads do tenant',
    description: 'Retorna todas as listas ordenadas por id ascendente.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: TenantLeadListResponseDto,
    isArray: true,
    description: 'Array de listas do tenant',
  })
  @ApiTenantScopedErrors({ notFound: 'Tenant não encontrado' })
  listLists(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.leadListsService.listLists(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar lista de leads',
    description:
      'Cria uma lista com `{ name }`. `costPerSend` inicia em 0 até o Super Admin precificar em /platform.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({ type: TenantLeadListResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'name inválido ou body inválido',
    forbidden:
      'costPerSend no body, tenant inativo ou Super Admin fora do pontapé',
    notFound: 'Tenant não encontrado',
  })
  createList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateLeadListDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.createList(tenantId, dto, req.user.roles, req.body);
  }

  @Get(':listId')
  @ApiOperation({ summary: 'Obter lista por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: TenantLeadListResponseDto })
  @ApiTenantScopedErrors({ notFound: 'Tenant ou lista não encontrado' })
  getList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.leadListsService.getList(tenantId, listId);
  }

  @Patch(':listId')
  @ApiOperation({
    summary: 'Atualizar lista (nome)',
    description:
      'PATCH parcial. `costPerSend` neste path retorna 403 — preço é /platform.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: TenantLeadListResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'name inválido ou body inválido',
    forbidden: 'costPerSend no body ou Super Admin fora da janela',
    notFound: 'Tenant ou lista não encontrado',
  })
  patchList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: PatchLeadListDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.patchList(
      tenantId,
      listId,
      dto,
      req.user.roles,
      req.body,
    );
  }

  @Get(':listId/import-template')
  @ApiOperation({
    summary: 'Baixar CSV de exemplo para importação',
    description:
      'Colunas: name, phone, website, category, reviews. Headers case-insensitive na importação.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkTextDownloadResponse('Arquivo CSV de exemplo para importação de leads')
  @ApiTenantScopedErrors({ notFound: 'Tenant ou lista não encontrado' })
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="lead-list-import-example.csv"',
  )
  downloadImportTemplate(@Res() res: Response) {
    res.send(this.leadListsService.getImportTemplateCsv());
  }

  @Post(':listId/import')
  @ApiOperation({
    summary: 'Importar leads via CSV',
    description:
      'Multipart field `file`. Falha atômica (400) se linha inválida ou phone duplicado no arquivo ou na lista.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo CSV conforme template de importação',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: LeadImportResultDto })
  @ApiTenantScopedErrors({
    badRequest: 'CSV inválido, file ausente ou phone duplicado',
    notFound: 'Tenant ou lista não encontrado',
  })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @UploadedFile() file?: { buffer: Buffer },
    @Req() req?: RequestUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file é obrigatório');
    }
    return this.leadListsService.importCsv(
      tenantId,
      listId,
      file.buffer,
      req?.user.roles ?? [],
    );
  }

  @Get(':listId/leads')
  @ApiOperation({ summary: 'Listar leads da lista' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({
    type: TenantListLeadResponseDto,
    isArray: true,
  })
  @ApiTenantScopedErrors({ notFound: 'Tenant ou lista não encontrado' })
  listLeads(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.leadListsService.listLeads(tenantId, listId);
  }

  @Post(':listId/leads/bulk')
  @ApiOperation({
    summary: 'Criar leads em lote',
    description: 'Transação atômica; falha se phone duplicado no body ou na lista.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiCreatedResponse({ type: LeadImportResultDto })
  @ApiTenantScopedErrors({
    badRequest: 'Phone duplicado ou validação falhou',
    notFound: 'Tenant ou lista não encontrado',
  })
  bulkCreateLeads(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: BulkCreateListLeadsDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.bulkCreateLeads(
      tenantId,
      listId,
      dto.leads,
      req.user.roles,
    );
  }

  @Post(':listId/leads')
  @ApiOperation({
    summary: 'Adicionar lead à lista',
    description: 'Phone normalizado; duplicata na lista retorna 400.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiCreatedResponse({ type: TenantListLeadResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'Phone duplicado ou campos inválidos',
    notFound: 'Tenant ou lista não encontrado',
  })
  createLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateListLeadDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.createLead(tenantId, listId, dto, req.user.roles);
  }

  @Get(':listId/leads/:leadId')
  @ApiOperation({ summary: 'Obter lead por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
  @ApiOkResponse({ type: TenantListLeadResponseDto })
  @ApiTenantScopedErrors({
    notFound: 'Tenant, lista ou lead não encontrado',
  })
  getLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
  ) {
    return this.leadListsService.getLead(tenantId, listId, leadId);
  }

  @Patch(':listId/leads/:leadId')
  @ApiOperation({ summary: 'Atualizar lead (parcial)' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
  @ApiOkResponse({ type: TenantListLeadResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'Phone duplicado na lista',
    notFound: 'Tenant, lista ou lead não encontrado',
  })
  patchLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: PatchListLeadDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.patchLead(
      tenantId,
      listId,
      leadId,
      dto,
      req.user.roles,
    );
  }

  @Delete(':listId/leads/:leadId')
  @ApiOperation({
    summary: 'Remover lead da lista',
    description: 'Retorna o registro removido (mesmo shape do GET).',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
  @ApiOkResponse({ type: TenantListLeadResponseDto })
  @ApiTenantScopedErrors({
    notFound: 'Tenant, lista ou lead não encontrado',
  })
  deleteLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Req() req: RequestUser,
  ) {
    return this.leadListsService.deleteLead(
      tenantId,
      listId,
      leadId,
      req.user.roles,
    );
  }
}

@ApiTags('Tenant — Lead Lists')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@Controller('tenant/:tenantId')
export class TenantCategorySuggestionsController {
  constructor(private readonly leadListsService: LeadListsService) {}

  @Get('category-suggestions')
  @ApiOperation({
    summary: 'Sugestões de categoria para autocomplete',
    description:
      'Distinct de Lead.category (via tenant_leads / pool global) e TenantListLead.category das listas do tenant. Dedup por normalização (acentos/minúsculas).',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    description: 'Lista de strings de categoria',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['Construtoras', 'Clínicas médicas', 'Consultorias'],
    },
  })
  @ApiTenantScopedErrors({ notFound: 'Tenant não encontrado' })
  categorySuggestions(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.leadListsService.categorySuggestions(tenantId);
  }
}

@ApiTags('Platform — Lead Lists')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/lead-lists')
export class PlatformLeadListsController {
  constructor(private readonly leadListsService: LeadListsService) {}

  @Patch(':listId')
  @ApiOperation({
    summary: 'Atualizar costPerSend da lista',
    description:
      'Somente Super Admin. `costPerSend` ≥ 0; 0 = campanha não envia. Não cria lista.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: TenantLeadListResponseDto })
  @ApiPlatformSuperAdminErrors({
    badRequest: 'costPerSend negativo ou body inválido',
    notFound: 'Tenant ou lista não encontrado',
  })
  patchCost(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: PatchListCostDto,
  ) {
    return this.leadListsService.patchListCost(tenantId, listId, dto.costPerSend);
  }
}
