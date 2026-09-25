import {
  Body,
  Controller,
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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { ApiPlatformSuperAdminErrors } from '../../swagger/api-route-errors.decorator';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { PatchWhatsappAccountDto } from './dto/patch-whatsapp-account.dto';
import { PatchWhatsappBusinessProfileDto } from './dto/patch-whatsapp-business-profile.dto';
import { WhatsappBusinessProfileResponseDto } from './dto/swagger/whatsapp-business-profile.swagger.dto';
import { WhatsappAccountResponseDto } from './dto/swagger/whatsapp-accounts.swagger.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';

@ApiTags('Platform — WhatsApp Accounts')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/whatsapp-accounts')
export class WhatsappAccountsController {
  constructor(
    private readonly whatsappAccountsService: WhatsappAccountsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar contas WhatsApp da plataforma (tenantId null)',
    description:
      'Retorna todas as contas da plataforma com isDefault; não filtra só a default. Nunca inclui access token.',
  })
  @ApiOkResponse({
    type: WhatsappAccountResponseDto,
    isArray: true,
    description: 'Contas da plataforma ordenadas por id',
  })
  @ApiPlatformSuperAdminErrors()
  list() {
    return this.whatsappAccountsService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar conta WhatsApp da plataforma',
    description:
      'Força tenantId=null e provider=CLOUD_API. wabaId deve coincidir com a default quando ela existe. isDefault opcional; a primeira conta vira default. Nunca envie token/accessToken — só tokenEnvKey.',
  })
  @ApiCreatedResponse({
    type: WhatsappAccountResponseDto,
    description: 'Conta criada (sem access token)',
  })
  @ApiPlatformSuperAdminErrors({
    badRequest: 'Validação, wabaId incompatível com default ou conflito de default',
    conflict: 'phoneNumberId ou combinação já existente',
  })
  create(@Body() dto: CreateWhatsappAccountDto, @Req() req: Request) {
    rejectSecretTokenFields(req.body);
    return this.whatsappAccountsService.create(dto);
  }

  @Get(':id/business-profile')
  @ApiOperation({
    summary: 'Ler WhatsApp Business Profile (proxy Graph live)',
    description:
      'GET Graph /{phone-number-id}/whatsapp_business_profile com o phoneNumberId e tokenEnvKey da conta `:id` (plataforma). Não exige isDefault. Nunca devolve access token. Não cadastra telefone.',
  })
  @ApiOkResponse({ type: WhatsappBusinessProfileResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Conta id inexistente',
    badRequest: 'Token ausente ou erro Graph 4xx',
  })
  getBusinessProfile(@Param('id', ParseIntPipe) id: number) {
    return this.whatsappAccountsService.getBusinessProfile(id);
  }

  @Patch(':id/business-profile')
  @ApiOperation({
    summary: 'Atualizar WhatsApp Business Profile (proxy Graph live)',
    description:
      'POST Graph com messaging_product=whatsapp e campos whitelist (about, address, description, email, websites, vertical, profile_picture_handle). Foto: obtenha handle via POST /platform/whatsapp-templates/media. Retorna profile atualizado (re-GET). Sem persistência Prisma; sem display name / register phone. Nunca envie token.',
  })
  @ApiOkResponse({ type: WhatsappBusinessProfileResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Conta id inexistente',
    badRequest: 'Validação ou erro Graph 4xx',
  })
  patchBusinessProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchWhatsappBusinessProfileDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.whatsappAccountsService.patchBusinessProfile(id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter conta WhatsApp da plataforma por id',
    description: 'Inclui isDefault. Nunca devolve access token.',
  })
  @ApiOkResponse({ type: WhatsappAccountResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Conta id inexistente',
  })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.whatsappAccountsService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar conta WhatsApp da plataforma',
    description:
      'Não aceita token Meta; só tokenEnvKey e campos não secretos. PATCH isDefault true promove e desmarca a anterior na mesma transação. Desabilitar a default é recusado.',
  })
  @ApiOkResponse({ type: WhatsappAccountResponseDto })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Conta id inexistente',
    badRequest: 'Tentativa de desabilitar a conta default ou validação falhou',
    conflict: 'Conflito ao promover default',
  })
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchWhatsappAccountDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.whatsappAccountsService.patch(id, dto);
  }
}
