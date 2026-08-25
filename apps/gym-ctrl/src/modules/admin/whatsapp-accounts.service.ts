import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { Prisma, WhatsappProvider } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { PatchWhatsappAccountDto } from './dto/patch-whatsapp-account.dto';
import { PatchWhatsappBusinessProfileDto } from './dto/patch-whatsapp-business-profile.dto';
import { GRAPH_API_VERSION } from './platform-whatsapp-admin.service';

const accountSelect = {
  id: true,
  provider: true,
  phoneNumberId: true,
  wabaId: true,
  displayPhone: true,
  tokenEnvKey: true,
  tenantId: true,
  enabled: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PROFILE_GRAPH_FIELDS =
  'about,address,description,email,profile_picture_url,websites,vertical';

type AccountWriter = {
  whatsappAccount: {
    findFirst: PrismaService['whatsappAccount']['findFirst'];
    updateMany: PrismaService['whatsappAccount']['updateMany'];
    create: PrismaService['whatsappAccount']['create'];
    update: PrismaService['whatsappAccount']['update'];
  };
};

export type WhatsappBusinessProfile = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
  profile_picture_url?: string;
};

type GraphProfileRow = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
  profile_picture_url?: string;
};

type GraphProfileListResponse = {
  data?: GraphProfileRow[];
};

@Injectable()
export class WhatsappAccountsService {
  private readonly logger = new Logger(WhatsappAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async list() {
    return this.prisma.whatsappAccount.findMany({
      where: { tenantId: null },
      select: accountSelect,
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateWhatsappAccountDto) {
    this.rejectNonNullTenantId(dto.tenantId);
    const currentDefault = await this.findPlatformDefault(this.prisma);
    const wantsDefault = currentDefault?.enabled !== true || dto.isDefault === true;
    const enabled = dto.enabled ?? true;

    if (wantsDefault && !enabled) {
      throw new BadRequestException(
        'A conta default não pode nascer ou permanecer desabilitada',
      );
    }

    this.assertFleetWaba(currentDefault, dto.wabaId);

    const data = this.buildCreateData(dto, wantsDefault);

    try {
      if (wantsDefault && currentDefault) {
        return await this.prisma.$transaction(async (tx) => {
          await this.demoteDefaults(tx, currentDefault.id);
          return tx.whatsappAccount.create({
            data,
            select: accountSelect,
          });
        });
      }

      return await this.prisma.whatsappAccount.create({
        data,
        select: accountSelect,
      });
    } catch (error) {
      this.rethrowUniquePhoneNumberId(error);
    }
  }

  async getById(id: number) {
    const account = await this.prisma.whatsappAccount.findUnique({
      where: { id },
      select: accountSelect,
    });
    if (!account || account.tenantId !== null) {
      throw new NotFoundException(
        `WhatsappAccount plataforma id=${id} não encontrada`,
      );
    }
    return account;
  }

  /**
   * Proxy live Graph GET /{phone-number-id}/whatsapp_business_profile.
   * Usa phoneNumberId + tokenEnvKey da conta `:id` (não exige isDefault).
   */
  async getBusinessProfile(id: number): Promise<WhatsappBusinessProfile> {
    const account = await this.getById(id);
    const token = this.resolveAccountToken(account.tokenEnvKey);
    return this.fetchBusinessProfile(account.phoneNumberId, token);
  }

  /**
   * Proxy live Graph POST /{phone-number-id}/whatsapp_business_profile.
   * Não persiste profile no Prisma; retorna profile atualizado via re-GET.
   */
  async patchBusinessProfile(
    id: number,
    dto: PatchWhatsappBusinessProfileDto,
  ): Promise<WhatsappBusinessProfile> {
    const account = await this.getById(id);
    const token = this.resolveAccountToken(account.tokenEnvKey);
    const body = this.buildProfilePatchBody(dto);

    if (Object.keys(body).length <= 1) {
      throw new BadRequestException(
        'Informe ao menos um campo de profile para atualizar (about, address, description, email, websites, vertical ou profile_picture_handle)',
      );
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}/whatsapp_business_profile`;
    this.logger.debug(
      `PATCH business-profile accountId=${account.id} phoneNumberId=${account.phoneNumberId}`,
    );

    try {
      await this.httpService.axiosRef.post(url, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      this.rethrowGraphError(error);
    }

    return this.fetchBusinessProfile(account.phoneNumberId, token);
  }

  async patch(id: number, dto: PatchWhatsappAccountDto) {
    const account = await this.getById(id);
    if ('tenantId' in dto) {
      this.rejectNonNullTenantId(dto.tenantId);
    }

    const currentDefault = await this.findPlatformDefault(this.prisma);
    const nextWabaId = dto.wabaId ?? account.wabaId;
    this.assertFleetWaba(currentDefault, nextWabaId);

    const nextIsDefault = dto.isDefault ?? account.isDefault;
    const nextEnabled = dto.enabled ?? account.enabled;

    if (nextIsDefault && nextEnabled === false) {
      throw new BadRequestException(
        'Não é permitido desabilitar a conta default',
      );
    }

    if (account.isDefault && dto.isDefault === false) {
      throw new BadRequestException(
        'Não é permitido remover o default sem promover outra conta',
      );
    }

    if (dto.isDefault === true) {
      await this.assertNotAssignedToTenant(id);
    }

    const data = {
      ...(dto.phoneNumberId !== undefined
        ? { phoneNumberId: dto.phoneNumberId }
        : {}),
      ...(dto.wabaId !== undefined ? { wabaId: dto.wabaId } : {}),
      ...(dto.displayPhone !== undefined
        ? { displayPhone: dto.displayPhone }
        : {}),
      ...(dto.tokenEnvKey !== undefined
        ? { tokenEnvKey: dto.tokenEnvKey }
        : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      tenantId: null,
    };

    const shouldPromote = dto.isDefault === true && !account.isDefault;

    try {
      if (shouldPromote) {
        return await this.prisma.$transaction(async (tx) => {
          await this.demoteDefaults(tx, id);
          return tx.whatsappAccount.update({
            where: { id },
            data,
            select: accountSelect,
          });
        });
      }

      return await this.prisma.whatsappAccount.update({
        where: { id },
        data,
        select: accountSelect,
      });
    } catch (error) {
      this.rethrowUniquePhoneNumberId(error);
    }
  }

  private buildCreateData(
    dto: CreateWhatsappAccountDto,
    isDefault: boolean,
  ): Prisma.WhatsappAccountUncheckedCreateInput {
    return {
      provider: WhatsappProvider.CLOUD_API,
      phoneNumberId: dto.phoneNumberId,
      wabaId: dto.wabaId,
      displayPhone: dto.displayPhone,
      tokenEnvKey: dto.tokenEnvKey ?? 'WHATSAPP_TOKEN',
      tenantId: null,
      enabled: dto.enabled ?? true,
      isDefault,
    };
  }

  private findPlatformDefault(db: AccountWriter) {
    return db.whatsappAccount.findFirst({
      where: { isDefault: true, tenantId: null },
      select: { id: true, wabaId: true, enabled: true },
    });
  }

  private assertFleetWaba(
    currentDefault: { wabaId: string } | null,
    wabaId: string,
  ) {
    if (currentDefault && wabaId !== currentDefault.wabaId) {
      throw new BadRequestException(
        'wabaId deve ser igual ao da conta default da frota',
      );
    }
  }

  private async demoteDefaults(db: AccountWriter, exceptId: number) {
    await db.whatsappAccount.updateMany({
      where: { isDefault: true, tenantId: null, id: { not: exceptId } },
      data: { isDefault: false },
    });
  }

  private async assertNotAssignedToTenant(accountId: number) {
    const assigned = await this.prisma.tenantOutreachConfig.findUnique({
      where: { whatsappAccountId: accountId },
      select: { tenantId: true },
    });
    if (assigned) {
      throw new BadRequestException(
        'Não é permitido promover a default uma conta amarrada a um tenant; desamarre antes',
      );
    }
  }

  private rethrowUniquePhoneNumberId(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('phoneNumberId já está em uso');
    }
    throw error;
  }

  private rejectNonNullTenantId(tenantId: number | null | undefined) {
    if (tenantId !== undefined && tenantId !== null) {
      throw new BadRequestException(
        'Contas WhatsApp com tenantId comercial não são suportadas no MVP; use tenantId null',
      );
    }
  }

  private resolveAccountToken(tokenEnvKey: string): string {
    const token = process.env[tokenEnvKey];
    if (!token) {
      throw new BadRequestException(
        `Token WhatsApp ausente: variável de ambiente "${tokenEnvKey}" não está definida ou está vazia`,
      );
    }
    return token;
  }

  private async fetchBusinessProfile(
    phoneNumberId: string,
    token: string,
  ): Promise<WhatsappBusinessProfile> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile`;
    try {
      const res = await this.httpService.axiosRef.get<GraphProfileListResponse>(
        url,
        {
          params: { fields: PROFILE_GRAPH_FIELDS },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return this.mapGraphProfile(res.data?.data?.[0]);
    } catch (error) {
      this.rethrowGraphError(error);
    }
  }

  private buildProfilePatchBody(
    dto: PatchWhatsappBusinessProfileDto,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
    };
    if (dto.about !== undefined) body.about = dto.about;
    if (dto.address !== undefined) body.address = dto.address;
    if (dto.description !== undefined) body.description = dto.description;
    if (dto.email !== undefined) body.email = dto.email;
    if (dto.websites !== undefined) body.websites = dto.websites;
    if (dto.vertical !== undefined) body.vertical = dto.vertical;
    if (dto.profile_picture_handle !== undefined) {
      body.profile_picture_handle = dto.profile_picture_handle;
    }
    return body;
  }

  private mapGraphProfile(
    row: GraphProfileRow | undefined,
  ): WhatsappBusinessProfile {
    if (!row) {
      return {};
    }
    const profile: WhatsappBusinessProfile = {};
    if (row.about !== undefined) profile.about = row.about;
    if (row.address !== undefined) profile.address = row.address;
    if (row.description !== undefined) profile.description = row.description;
    if (row.email !== undefined) profile.email = row.email;
    if (row.websites !== undefined) profile.websites = row.websites;
    if (row.vertical !== undefined) profile.vertical = row.vertical;
    if (row.profile_picture_url !== undefined) {
      profile.profile_picture_url = row.profile_picture_url;
    }
    return profile;
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
