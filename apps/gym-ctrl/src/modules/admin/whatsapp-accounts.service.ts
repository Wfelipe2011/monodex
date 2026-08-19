import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WhatsappProvider } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { PatchWhatsappAccountDto } from './dto/patch-whatsapp-account.dto';

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

type AccountWriter = {
  whatsappAccount: {
    findFirst: PrismaService['whatsappAccount']['findFirst'];
    updateMany: PrismaService['whatsappAccount']['updateMany'];
    create: PrismaService['whatsappAccount']['create'];
    update: PrismaService['whatsappAccount']['update'];
  };
};

@Injectable()
export class WhatsappAccountsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
