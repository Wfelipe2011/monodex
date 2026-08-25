import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import {
  GRAPH_API_VERSION,
  PlatformWhatsappAdminService,
} from './platform-whatsapp-admin.service';

/** MIME aceitos pela Graph Resumable Upload para header IMAGE / profile picture (MVP). */
export const META_UPLOAD_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const META_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export type MetaUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
};

type CreateSessionResponse = {
  id?: string;
};

type UploadBinaryResponse = {
  h?: string;
};

@Injectable()
export class MetaResumableUploadService {
  private readonly logger = new Logger(MetaResumableUploadService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappAdminService,
  ) {}

  /**
   * Fluxo Resumable Upload Meta (APP_ID/uploads → session → handle).
   * Token via conta default da plataforma; nunca grava TenantMedia.
   */
  async uploadImage(file: MetaUploadFile | undefined): Promise<{ handle: string }> {
    this.assertValidFile(file);

    const appId = process.env.META_APP_ID?.trim();
    if (!appId) {
      throw new BadRequestException(
        'META_APP_ID não configurada: defina a variável de ambiente com o App ID do Meta Developer',
      );
    }

    const creds = await this.platformWhatsapp.resolveCredentials();
    const mime = (file!.mimetype || '').toLowerCase();
    const fileName =
      file!.originalname?.trim() ||
      (mime.includes('png') ? 'upload.png' : 'upload.jpg');
    const fileLength = file!.buffer.length;

    this.logger.debug(
      `Resumable upload: appId=${appId}, fileLength=${fileLength}, mime=${mime}, accountId=${creds.accountId}`,
    );

    const sessionId = await this.createUploadSession({
      appId,
      token: creds.token,
      fileName,
      fileLength,
      fileType: mime === 'image/jpg' ? 'image/jpeg' : mime,
    });

    const handle = await this.uploadFileBinary({
      sessionId,
      token: creds.token,
      buffer: file!.buffer,
    });

    return { handle };
  }

  private assertValidFile(file: MetaUploadFile | undefined): asserts file is MetaUploadFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file é obrigatório e não pode estar vazio');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!META_UPLOAD_ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'MIME não permitido; use image/jpeg ou image/png',
      );
    }
    const size = file.size ?? file.buffer.length;
    if (size > META_UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${META_UPLOAD_MAX_BYTES} bytes`,
      );
    }
  }

  private async createUploadSession(params: {
    appId: string;
    token: string;
    fileName: string;
    fileLength: number;
    fileType: string;
  }): Promise<string> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.appId}/uploads`;
    try {
      const res = await this.httpService.axiosRef.post<CreateSessionResponse>(
        url,
        null,
        {
          params: {
            file_name: params.fileName,
            file_length: params.fileLength,
            file_type: params.fileType,
          },
          headers: { Authorization: `Bearer ${params.token}` },
        },
      );
      const sessionId = res.data?.id?.trim();
      if (!sessionId) {
        throw new BadRequestException(
          'Graph API: resposta de sessão de upload sem id',
        );
      }
      return sessionId;
    } catch (error) {
      return this.rethrowGraphError(error);
    }
  }

  private async uploadFileBinary(params: {
    sessionId: string;
    token: string;
    buffer: Buffer;
  }): Promise<string> {
    const sessionPath = params.sessionId.startsWith('upload:')
      ? params.sessionId
      : `upload:${params.sessionId}`;
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${sessionPath}`;
    try {
      const res = await this.httpService.axiosRef.post<UploadBinaryResponse>(
        url,
        params.buffer,
        {
          headers: {
            Authorization: `OAuth ${params.token}`,
            file_offset: '0',
            'Content-Type': 'application/octet-stream',
          },
          maxBodyLength: META_UPLOAD_MAX_BYTES,
          maxContentLength: META_UPLOAD_MAX_BYTES,
        },
      );
      const handle = res.data?.h?.trim();
      if (!handle) {
        throw new BadRequestException(
          'Graph API: resposta de upload sem handle',
        );
      }
      return handle;
    } catch (error) {
      return this.rethrowGraphError(error);
    }
  }

  private rethrowGraphError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const payload = error.response?.data as
        | { error?: { message?: string } }
        | undefined;
      const message =
        payload?.error?.message ?? error.message ?? 'erro desconhecido';
      if (status && status >= 400 && status < 500) {
        throw new BadRequestException(`Graph API: ${message}`);
      }
      throw new BadGatewayException(`Graph API: ${message}`);
    }
    throw error;
  }
}
