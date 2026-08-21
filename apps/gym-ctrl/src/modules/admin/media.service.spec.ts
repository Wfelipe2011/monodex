import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Roles } from '@prisma/client';
import { API_KEY_ALLOWLIST_KEY } from '@core/decorators/api-key-allowlist.decorator';
import { IS_PUBLIC_KEY } from '@core/decorators/public.decorator';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { MediaController } from './media.controller';
import { PublicMediaController } from './public-media.controller';
import { MAX_MEDIA_BYTES, MediaService } from './media.service';

type StoredMedia = {
  id: number;
  publicId: string;
  tenantId: number;
  originalFileName: string;
  mimeType: string;
  relativePath: string;
  byteSize: number;
  createdAt: Date;
};

describe('MediaController metadata', () => {
  it('path, roles, allowlist, guards e tag', () => {
    expect(Reflect.getMetadata(PATH_METADATA, MediaController)).toBe(
      'tenant/:tenantId/media',
    );
    expect(Reflect.getMetadata(ROLES_KEY, MediaController)).toEqual([
      Roles.ADMIN,
      Roles.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(API_KEY_ALLOWLIST_KEY, MediaController)).toBe(
      true,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, MediaController)).toEqual([
      TenantScopeGuard,
      TenantActiveGuard,
    ]);
    expect(Reflect.getMetadata(DECORATORS.API_TAGS, MediaController)).toEqual([
      'Tenant — Media',
    ]);
  });
});

describe('PublicMediaController metadata', () => {
  it('path público, @Public no GET, sem RolesAuth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PublicMediaController)).toBe(
      'public/media',
    );
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        PublicMediaController.prototype.getByPublicId,
      ),
    ).toBe(':publicId');
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PublicMediaController.prototype.getByPublicId,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(ROLES_KEY, PublicMediaController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        PublicMediaController.prototype.getByPublicId,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(API_KEY_ALLOWLIST_KEY, PublicMediaController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(DECORATORS.API_TAGS, PublicMediaController),
    ).toEqual(['Public — Media']);
  });
});

describe('MediaService', () => {
  let tmpDir: string;
  let store: StoredMedia[];
  let nextId: number;
  let service: MediaService;

  const prisma = {
    tenantMedia: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const config = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tenant-media-'));
    store = [];
    nextId = 1;
    jest.clearAllMocks();

    config.get.mockImplementation((key: string) => {
      if (key === 'TENANT_MEDIA_DIR') return tmpDir;
      if (key === 'PUBLIC_API_BASE_URL') return 'https://api.example.com';
      return undefined;
    });

    prisma.tenantMedia.create.mockImplementation(
      async ({ data }: { data: Omit<StoredMedia, 'id' | 'publicId' | 'createdAt'> }) => {
        const row: StoredMedia = {
          id: nextId++,
          publicId: `aaaaaaaa-bbbb-cccc-dddd-${String(nextId).padStart(12, '0')}`,
          tenantId: data.tenantId,
          originalFileName: data.originalFileName,
          mimeType: data.mimeType,
          relativePath: data.relativePath,
          byteSize: data.byteSize,
          createdAt: new Date('2026-08-21T12:00:00.000Z'),
        };
        store.push(row);
        return { ...row, updatedAt: row.createdAt };
      },
    );

    prisma.tenantMedia.findMany.mockImplementation(
      async (args?: {
        where?: { tenantId?: number };
        select?: { relativePath?: boolean };
      }) => {
        if (args?.select?.relativePath) {
          return store.map((c) => ({ relativePath: c.relativePath }));
        }
        const tenantId = args?.where?.tenantId;
        return store
          .filter((c) => tenantId == null || c.tenantId === tenantId)
          .map((c) => ({
            id: c.id,
            publicId: c.publicId,
            originalFileName: c.originalFileName,
            mimeType: c.mimeType,
            byteSize: c.byteSize,
            createdAt: c.createdAt,
          }));
      },
    );

    prisma.tenantMedia.findUnique.mockImplementation(
      async ({ where }: { where: { publicId: string } }) => {
        const hit = store.find((c) => c.publicId === where.publicId);
        return hit ? { ...hit, updatedAt: hit.createdAt } : null;
      },
    );

    service = new MediaService(prisma as never, config as never);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeUpload(
    tenantId: number,
    name: string,
    contents: Buffer,
    mime = 'image/png',
  ) {
    const dir = path.join(tmpDir, String(tenantId));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, contents);
    return {
      path: filePath,
      originalname: name,
      mimetype: mime,
      size: contents.length,
    };
  }

  it('save + list são tenant-scoped e não expõem relativePath', async () => {
    const f4 = await writeUpload(4, 'a.png', Buffer.from('png4'));
    const saved4 = await service.saveUpload(4, f4);
    expect(saved4).toMatchObject({
      id: expect.any(Number),
      publicId: expect.any(String),
      originalFileName: 'a.png',
      mimeType: 'image/png',
      byteSize: 4,
    });
    expect(saved4).not.toHaveProperty('relativePath');

    const f5 = await writeUpload(5, 'b.png', Buffer.from('png5'));
    await service.saveUpload(5, f5);

    const list4 = await service.list(4);
    expect(list4).toHaveLength(1);
    expect(list4[0].publicId).toBe(saved4.publicId);
    expect(list4[0]).not.toHaveProperty('relativePath');
  });

  it('rejeita MIME inválido sem persistir row', async () => {
    const f = await writeUpload(
      4,
      'x.svg',
      Buffer.from('<svg/>'),
      'image/svg+xml',
    );
    await expect(service.saveUpload(4, f)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tenantMedia.create).not.toHaveBeenCalled();
  });

  it('rejeita arquivo > 5 MB sem persistir row', async () => {
    const big = Buffer.alloc(MAX_MEDIA_BYTES + 1, 1);
    const f = await writeUpload(4, 'big.png', big);
    await expect(service.saveUpload(4, f)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tenantMedia.create).not.toHaveBeenCalled();
  });

  it('publicUrl monta URL absoluta', () => {
    expect(service.publicUrl('aaa-bbb')).toBe(
      'https://api.example.com/public/media/aaa-bbb',
    );
    expect(service.publicMediaUrl('aaa-bbb')).toBe(
      'https://api.example.com/public/media/aaa-bbb',
    );
  });

  it('publicUrl lança 400 se PUBLIC_API_BASE_URL ausente', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'TENANT_MEDIA_DIR') return tmpDir;
      return undefined;
    });
    expect(() => service.publicUrl('x')).toThrow(BadRequestException);
  });

  it('openPublicFile 404 para id inexistente', async () => {
    await expect(service.openPublicFile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('openPublicFile devolve stream para publicId existente', async () => {
    const f = await writeUpload(4, 'ok.png', Buffer.from('hello'));
    const saved = await service.saveUpload(4, f);
    const opened = await service.openPublicFile(saved.publicId);
    expect(opened.mimeType).toBe('image/png');
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('cleanupOrphanFiles apaga órfão e mantém referenciado', async () => {
    const f = await writeUpload(4, 'kept.png', Buffer.from('keep'));
    await service.saveUpload(4, f);

    const orphanRel = path.join(tmpDir, '4', 'orphan.png');
    await fs.writeFile(orphanRel, Buffer.from('trash'));

    const result = await service.cleanupOrphanFiles();
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(result.kept).toBeGreaterThanOrEqual(1);

    await expect(fs.access(orphanRel)).rejects.toThrow();
    await expect(fs.access(f.path)).resolves.toBeUndefined();
    expect(store).toHaveLength(1);
  });
});
