import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { PatchWhatsappAccountDto } from './dto/patch-whatsapp-account.dto';
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
  list() {
    return this.whatsappAccountsService.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Criar conta WhatsApp da plataforma',
    description:
      'Força tenantId=null e provider=CLOUD_API. wabaId deve coincidir com a default quando ela existe. isDefault opcional; a primeira conta vira default. Nunca envie token/accessToken — só tokenEnvKey.',
  })
  create(@Body() dto: CreateWhatsappAccountDto, @Req() req: Request) {
    rejectSecretTokenFields(req.body);
    return this.whatsappAccountsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter conta WhatsApp da plataforma por id',
    description: 'Inclui isDefault. Nunca devolve access token.',
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
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchWhatsappAccountDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.whatsappAccountsService.patch(id, dto);
  }
}
