import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';
import { MetaResumableUploadService } from './meta-resumable-upload.service';

const APP_ID = '1234567890';
const HANDLE =
  '4:aW1hZ2UvanBlZw==:ARZ9oTHzo9igJVD5QgwemUWSkOv3vl4dzdBovSFUy2yz5fFAgSqDZOI';
const SESSION_ID = 'upload:session-abc';
const TOKEN = 'secret-token-never-return';

describe('MetaResumableUploadService', () => {
  const defaultCreds = {
    accountId: 1,
    wabaId: 'waba-1',
    phoneNumberId: 'phone-1',
    token: TOKEN,
    messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/phone-1/messages`,
  };

  function build() {
    const httpService = {
      axiosRef: {
        post: jest.fn(),
        get: jest.fn(),
      },
    };
    const platformWhatsapp = {
      resolveCredentials: jest.fn().mockResolvedValue(defaultCreds),
    };
    const service = new MetaResumableUploadService(
      httpService as never,
      platformWhatsapp as never,
    );
    return { service, httpService, platformWhatsapp };
  }

  const pngFile = {
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    mimetype: 'image/png',
    originalname: 'header.png',
    size: 6,
  };

  beforeEach(() => {
    process.env.META_APP_ID = APP_ID;
  });

  afterEach(() => {
    delete process.env.META_APP_ID;
  });

  it('happy path: retorna handle não-vazio e não inclui token', async () => {
    const { service, httpService, platformWhatsapp } = build();
    httpService.axiosRef.post
      .mockResolvedValueOnce({ data: { id: SESSION_ID } })
      .mockResolvedValueOnce({ data: { h: HANDLE } });

    const result = await service.uploadImage(pngFile);

    expect(result).toEqual({ handle: HANDLE });
    expect(result.handle.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('accessToken');
    expect(platformWhatsapp.resolveCredentials).toHaveBeenCalledWith();

    expect(httpService.axiosRef.post).toHaveBeenNthCalledWith(
      1,
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${APP_ID}/uploads`,
      null,
      expect.objectContaining({
        params: {
          file_name: 'header.png',
          file_length: pngFile.buffer.length,
          file_type: 'image/png',
        },
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(httpService.axiosRef.post).toHaveBeenNthCalledWith(
      2,
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${SESSION_ID}`,
      pngFile.buffer,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `OAuth ${TOKEN}`,
          file_offset: '0',
        }),
      }),
    );
  });

  it('META_APP_ID ausente → 400 claro', async () => {
    delete process.env.META_APP_ID;
    const { service, httpService, platformWhatsapp } = build();

    let caught: unknown;
    try {
      await service.uploadImage(pngFile);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).message).toMatch(/META_APP_ID/);
    expect(platformWhatsapp.resolveCredentials).not.toHaveBeenCalled();
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('Graph 400 → BadRequestException com prefixo Graph API', async () => {
    const { service, httpService } = build();
    const graphError = new axios.AxiosError(
      'Request failed',
      '400',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: {} } as never,
        data: { error: { message: 'Invalid file type' } },
      },
    );
    httpService.axiosRef.post.mockRejectedValueOnce(graphError);

    let caught: unknown;
    try {
      await service.uploadImage(pngFile);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse();
    const msg =
      typeof response === 'string'
        ? response
        : (response as { message?: string | string[] }).message;
    expect(msg).toEqual('Graph API: Invalid file type');
    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(1);
  });

  it('arquivo vazio → 400', async () => {
    const { service, httpService } = build();
    await expect(
      service.uploadImage({
        buffer: Buffer.alloc(0),
        mimetype: 'image/png',
        originalname: 'empty.png',
      }),
    ).rejects.toThrow(/vazio|obrigatório/);
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('MIME webp rejeitado no MVP', async () => {
    const { service, httpService } = build();
    await expect(
      service.uploadImage({
        buffer: Buffer.from([1, 2, 3]),
        mimetype: 'image/webp',
        originalname: 'x.webp',
      }),
    ).rejects.toThrow(/MIME/);
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });
});
