import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { PatchWhatsappTemplateDto } from './dto/patch-whatsapp-template.dto';
import { TestWhatsappTemplateDto } from './dto/test-whatsapp-template.dto';
import { MetaMediaHandleResponseDto } from './dto/swagger/whatsapp-template-media.swagger.dto';
import {
  WhatsappTemplateDeletedDto,
  WhatsappTemplatePreviewDto,
} from './dto/swagger/whatsapp-template-preview.swagger.dto';
import {
  META_UPLOAD_ALLOWED_MIME,
  META_UPLOAD_MAX_BYTES,
  MetaResumableUploadService,
  MetaUploadFile,
} from './meta-resumable-upload.service';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

@ApiTags('Platform — WhatsApp Templates')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/whatsapp-templates')
export class WhatsappTemplatesController {
  constructor(
    private readonly whatsappTemplatesService: WhatsappTemplatesService,
    private readonly metaResumableUpload: MetaResumableUploadService,
  ) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sincronizar catálogo de templates a partir da WABA da plataforma',
  })
  sync(@Req() req: RequestUser) {
    rejectSecretTokenFields(req.body);
    return this.whatsappTemplatesService.sync();
  }

  @Post('media')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload de imagem na Meta (Resumable Upload) para obter handle',
    description:
      'Campo multipart `file` (jpeg/png, máx. 5 MB). Retorna handle opaco para header IMAGE de template ou profile_picture_handle. Requer META_APP_ID e token da conta default. Não persiste em TenantMedia.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    type: MetaMediaHandleResponseDto,
    description: 'Handle Meta opaco (sem access token)',
  })
  @ApiBadRequestResponse({
    description: 'MIME inválido, arquivo vazio, META_APP_ID ausente ou erro Graph 4xx',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: META_UPLOAD_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (!META_UPLOAD_ALLOWED_MIME.has(mime)) {
          cb(
            new BadRequestException(
              'MIME não permitido; use image/jpeg ou image/png',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadMedia(
    @UploadedFile() file: MetaUploadFile | undefined,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.metaResumableUpload.uploadImage(file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar template MARKETING na WABA default',
    description:
      'POST Graph message_templates + upsert no catálogo local (slots derivados). ' +
      'Somente category=MARKETING (MVP). Status típico inicial: PENDING. Não cria grants. ' +
      'Preview: resposta traz components + slots; interpolação de {{n}} é client-side.',
  })
  @ApiCreatedResponse({
    type: WhatsappTemplatePreviewDto,
    description: 'Preview do template criado/upsertado (components com BODY.text)',
  })
  @ApiBadRequestResponse({
    description: 'Validação, category ≠ MARKETING, IMAGE sem handle ou erro Graph 4xx',
  })
  create(@Body() dto: CreateWhatsappTemplateDto, @Req() req: RequestUser) {
    rejectSecretTokenFields(req.body);
    return this.whatsappTemplatesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar templates do catálogo (preview: components + slots)',
    description:
      'Retorna metadados, slots estáveis e components no shape Meta para preview client-side ' +
      '(substituir {{1}} com slots + variáveis no front). Sem sync Graph nesta chamada.',
  })
  @ApiOkResponse({
    type: WhatsappTemplatePreviewDto,
    isArray: true,
    description: 'Catálogo com BODY.text e slots para preview',
  })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'name', required: false, type: String })
  list(@Query('status') status?: string, @Query('name') name?: string) {
    return this.whatsappTemplatesService.list({ status, name });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter template do catálogo por id (preview)',
    description:
      'Mesmo shape da listagem (components + slots). Preview client-side. ' +
      '404 se id inexistente. Sem sync Graph.',
  })
  @ApiOkResponse({ type: WhatsappTemplatePreviewDto })
  @ApiNotFoundResponse({ description: 'Template id inexistente' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.whatsappTemplatesService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar template MARKETING (Graph full replace de components)',
    description:
      'Exige metaId. name e language não podem ser alterados. Local só atualiza após Graph OK. ' +
      'MVP: category MARKETING. Resposta = preview (components + slots).',
  })
  @ApiOkResponse({ type: WhatsappTemplatePreviewDto })
  @ApiBadRequestResponse({
    description: 'metaId null, name/language no body, validação ou erro Graph 4xx',
  })
  @ApiNotFoundResponse({ description: 'Template id inexistente' })
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchWhatsappTemplateDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    if (
      Object.prototype.hasOwnProperty.call(req.body ?? {}, 'name') ||
      Object.prototype.hasOwnProperty.call(req.body ?? {}, 'language')
    ) {
      throw new BadRequestException(
        'name e language não podem ser alterados via PATCH',
      );
    }
    return this.whatsappTemplatesService.patch(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir template na Graph e no catálogo local',
    description:
      '409 Conflict se houver grant, outreach, campanha ou on-demand referenciando o id. ' +
      'Sem cascade de grants — remova FKs antes. Sucesso: { deleted: true, id }.',
  })
  @ApiOkResponse({ type: WhatsappTemplateDeletedDto })
  @ApiConflictResponse({
    description: 'Template ainda referenciado por FKs locais (HTTP 409)',
  })
  @ApiNotFoundResponse({ description: 'Template id inexistente' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.whatsappTemplatesService.delete(id);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Enviar template do catálogo para um número (sem TenantLead/coin)',
  })
  test(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TestWhatsappTemplateDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    const operatorUserId = req.user?.userId ?? req.user?.id;
    return this.whatsappTemplatesService.testSend(id, dto, operatorUserId);
  }
}
