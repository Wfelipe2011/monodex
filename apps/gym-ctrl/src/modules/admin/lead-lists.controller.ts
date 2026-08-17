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
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request, Response } from 'express';
import { LeadListsService } from './lead-lists.service';
import { CreateLeadListDto } from './dto/create-lead-list.dto';
import { PatchLeadListDto } from './dto/patch-lead-list.dto';
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

@ApiTags('Admin — Lead Lists')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId/lead-lists')
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
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  listLists(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.leadListsService.listLists(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar lista de leads',
    description: 'Cria uma lista com `costPerSend` > 0 (coins debitados por envio).',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({ type: TenantLeadListResponseDto })
  @ApiBadRequestResponse({ description: 'costPerSend inválido ou body inválido' })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  createList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateLeadListDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.createList(tenantId, dto);
  }

  @Get(':listId')
  @ApiOperation({ summary: 'Obter lista por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: TenantLeadListResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  getList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.leadListsService.getList(tenantId, listId);
  }

  @Patch(':listId')
  @ApiOperation({
    summary: 'Atualizar lista (nome e/ou costPerSend)',
    description: 'PATCH parcial — envie apenas os campos a alterar.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: TenantLeadListResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  patchList(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: PatchLeadListDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.patchList(tenantId, listId, dto);
  }

  @Get(':listId/import-template')
  @ApiOperation({
    summary: 'Baixar CSV de exemplo para importação',
    description:
      'Colunas: name, phone, website, category, reviews. Headers case-insensitive na importação.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Arquivo CSV de exemplo',
    schema: {
      type: 'string',
      example:
        'name,phone,website,category,reviews\nConstrutora Exemplo,(11) 98765-4321,https://exemplo.com.br,Construtoras,42',
    },
  })
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
  @ApiBadRequestResponse({
    description: 'CSV inválido, file ausente ou phone duplicado',
  })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file é obrigatório');
    }
    return this.leadListsService.importCsv(tenantId, listId, file.buffer);
  }

  @Get(':listId/leads')
  @ApiOperation({ summary: 'Listar leads da lista' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({
    type: TenantListLeadResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
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
  @ApiBadRequestResponse({ description: 'Phone duplicado ou validação falhou' })
  bulkCreateLeads(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: BulkCreateListLeadsDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.bulkCreateLeads(tenantId, listId, dto.leads);
  }

  @Post(':listId/leads')
  @ApiOperation({
    summary: 'Adicionar lead à lista',
    description: 'Phone normalizado; duplicata na lista retorna 400.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiCreatedResponse({ type: TenantListLeadResponseDto })
  @ApiBadRequestResponse({ description: 'Phone duplicado ou campos inválidos' })
  createLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateListLeadDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.createLead(tenantId, listId, dto);
  }

  @Get(':listId/leads/:leadId')
  @ApiOperation({ summary: 'Obter lead por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
  @ApiOkResponse({ type: TenantListLeadResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant, lista ou lead não encontrado' })
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
  @ApiBadRequestResponse({ description: 'Phone duplicado na lista' })
  patchLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: PatchListLeadDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.leadListsService.patchLead(tenantId, listId, leadId, dto);
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
  @ApiNotFoundResponse({ description: 'Tenant, lista ou lead não encontrado' })
  deleteLead(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
  ) {
    return this.leadListsService.deleteLead(tenantId, listId, leadId);
  }
}

@ApiTags('Admin — Lead Lists')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin/tenants/:tenantId')
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
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  categorySuggestions(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.leadListsService.categorySuggestions(tenantId);
  }
}
