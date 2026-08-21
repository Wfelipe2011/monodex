import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { ApiKeyAllowlist } from '@core/decorators/api-key-allowlist.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import { TenantMediaItemDto } from './dto/swagger/tenant-on-demand.swagger.dto';
import {
  ALLOWED_MEDIA_MIME,
  MAX_MEDIA_BYTES,
  MediaService,
  UploadedMediaFile,
} from './media.service';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function resolveMediaDir(): string {
  return process.env.TENANT_MEDIA_DIR?.trim() || 'uploads/tenant-media';
}

@ApiTags('Tenant — Media')
@ApiBearerAuth()
@ApiSecurity('X-API-KEY')
@ApiKeyAllowlist()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mídias do tenant (sem path interno)' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: TenantMediaItemDto,
    isArray: true,
    description: 'Lista ordenada por createdAt desc',
  })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.mediaService.list(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload de imagem (jpeg/png/webp, máx. 5 MB)',
    description:
      'Campo multipart `file`. Super Admin recebe 403. API key permitida via allowlist.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
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
    type: TenantMediaItemDto,
    description: 'Mídia persistida (sem relativePath)',
  })
  @ApiBadRequestResponse({
    description: 'MIME inválido, arquivo ausente ou > 5 MB',
  })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = String(
            (req as { params?: { tenantId?: string } }).params?.tenantId ?? '',
          );
          if (!/^\d+$/.test(tenantId)) {
            cb(new BadRequestException('tenantId inválido'), '');
            return;
          }
          const dir = path.join(resolveMediaDir(), tenantId);
          try {
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          } catch (err) {
            cb(err as Error, '');
          }
        },
        filename: (_req, file, cb) => {
          const mime = (file.mimetype || '').toLowerCase();
          const ext = MIME_TO_EXT[mime] ?? 'bin';
          cb(null, `${randomUUID()}.${ext}`);
        },
      }),
      limits: { fileSize: MAX_MEDIA_BYTES },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (!ALLOWED_MEDIA_MIME.has(mime)) {
          cb(
            new BadRequestException(
              'MIME não permitido; use image/jpeg, image/png ou image/webp',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Req() req: RequestUser,
  ) {
    if (req.user.roles?.includes(Roles.SUPER_ADMIN)) {
      if (file?.path) {
        await this.mediaService.safeUnlink(file.path);
      }
      throw new ForbiddenException('Acesso não permitido');
    }
    return this.mediaService.saveUpload(tenantId, file);
  }
}
