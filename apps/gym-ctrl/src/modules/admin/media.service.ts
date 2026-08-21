import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export const ALLOWED_MEDIA_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export type TenantMediaListItem = {
  id: number;
  publicId: string;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date;
};

export type UploadedMediaFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  mediaDir(): string {
    return (
      this.config.get<string>('TENANT_MEDIA_DIR')?.trim() ||
      'uploads/tenant-media'
    );
  }

  absolutePath(relativePath: string): string {
    return path.resolve(this.mediaDir(), ...relativePath.split('/'));
  }

  /** URL absoluta para Graph / clientes; lança 400 se PUBLIC_API_BASE_URL ausente. */
  publicUrl(publicId: string): string {
    const base = this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '');
    if (!base) {
      throw new BadRequestException('PUBLIC_API_BASE_URL não configurada');
    }
    return `${base}/public/media/${publicId}`;
  }

  /** Alias pedido no design / handoff. */
  publicMediaUrl(publicId: string): string {
    return this.publicUrl(publicId);
  }

  toListItem(row: {
    id: number;
    publicId: string;
    originalFileName: string;
    mimeType: string;
    byteSize: number;
    createdAt: Date;
  }): TenantMediaListItem {
    return {
      id: row.id,
      publicId: row.publicId,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      createdAt: row.createdAt,
    };
  }

  async list(tenantId: number): Promise<TenantMediaListItem[]> {
    const rows = await this.prisma.tenantMedia.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        publicId: true,
        originalFileName: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
      },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async findByPublicId(publicId: string) {
    return this.prisma.tenantMedia.findUnique({ where: { publicId } });
  }

  async findOwnedById(tenantId: number, id: number) {
    return this.prisma.tenantMedia.findFirst({ where: { id, tenantId } });
  }

  async findOwnedByPublicId(tenantId: number, publicId: string) {
    return this.prisma.tenantMedia.findFirst({ where: { publicId, tenantId } });
  }

  async openPublicFile(publicId: string): Promise<{
    stream: Readable;
    mimeType: string;
    byteSize: number;
  }> {
    const row = await this.findByPublicId(publicId);
    if (!row) {
      throw new NotFoundException('Mídia não encontrada');
    }
    const abs = this.absolutePath(row.relativePath);
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('Mídia não encontrada');
    }
    return {
      stream: createReadStream(abs),
      mimeType: row.mimeType,
      byteSize: row.byteSize,
    };
  }

  async saveUpload(
    tenantId: number,
    file: UploadedMediaFile | undefined,
  ): Promise<TenantMediaListItem> {
    if (!file?.path) {
      throw new BadRequestException('file é obrigatório');
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MEDIA_MIME.has(mime)) {
      await this.safeUnlink(file.path);
      throw new BadRequestException(
        'MIME não permitido; use image/jpeg, image/png ou image/webp',
      );
    }
    if (file.size > MAX_MEDIA_BYTES) {
      await this.safeUnlink(file.path);
      throw new BadRequestException('Arquivo excede o limite de 5 MB');
    }

    const fileName = path.basename(file.path);
    const relativePath = this.normalizeRelativePath(`${tenantId}/${fileName}`);
    const destAbs = this.absolutePath(relativePath);
    const uploadedAbs = path.resolve(file.path);

    if (uploadedAbs !== destAbs) {
      await fs.mkdir(path.dirname(destAbs), { recursive: true });
      await fs.rename(uploadedAbs, destAbs).catch(async () => {
        await fs.copyFile(uploadedAbs, destAbs);
        await this.safeUnlink(uploadedAbs);
      });
    }

    try {
      const row = await this.prisma.tenantMedia.create({
        data: {
          tenantId,
          originalFileName: file.originalname || fileName,
          mimeType: mime,
          relativePath,
          byteSize: file.size,
        },
      });
      return this.toListItem(row);
    } catch (err) {
      await this.safeUnlink(destAbs);
      throw err;
    }
  }

  /** Remove arquivos no media dir sem row TenantMedia correspondente. */
  async cleanupOrphanFiles(): Promise<{ deleted: number; kept: number }> {
    const mediaRoot = path.resolve(this.mediaDir());
    let deleted = 0;
    let kept = 0;

    try {
      await fs.access(mediaRoot);
    } catch {
      return { deleted: 0, kept: 0 };
    }

    const rows = await this.prisma.tenantMedia.findMany({
      select: { relativePath: true },
    });
    const referenced = new Set(
      rows.map((r) => this.normalizeRelativePath(r.relativePath)),
    );

    const files = await this.listFilesRecursive(mediaRoot);
    for (const abs of files) {
      const rel = this.normalizeRelativePath(
        path.relative(mediaRoot, abs),
      );
      if (!rel || rel.startsWith('..')) {
        continue;
      }
      if (referenced.has(rel)) {
        kept += 1;
        continue;
      }
      await this.safeUnlink(abs);
      deleted += 1;
    }

    return { deleted, kept };
  }

  normalizeRelativePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore missing / already gone
    }
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await this.listFilesRecursive(full)));
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
    return out;
  }
}
