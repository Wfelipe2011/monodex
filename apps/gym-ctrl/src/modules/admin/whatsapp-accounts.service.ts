import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WhatsappProvider } from '@prisma/client';
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
  createdAt: true,
  updatedAt: true,
} as const;

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
    return this.prisma.whatsappAccount.create({
      data: {
        provider: WhatsappProvider.CLOUD_API,
        phoneNumberId: dto.phoneNumberId,
        wabaId: dto.wabaId,
        displayPhone: dto.displayPhone,
        tokenEnvKey: dto.tokenEnvKey ?? 'WHATSAPP_TOKEN',
        tenantId: null,
        enabled: dto.enabled ?? true,
      },
      select: accountSelect,
    });
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
    await this.getById(id);
    if ('tenantId' in dto) {
      this.rejectNonNullTenantId(dto.tenantId);
    }

    return this.prisma.whatsappAccount.update({
      where: { id },
      data: {
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
        // MVP: sempre plataforma
        tenantId: null,
      },
      select: accountSelect,
    });
  }

  private rejectNonNullTenantId(tenantId: number | null | undefined) {
    if (tenantId !== undefined && tenantId !== null) {
      throw new BadRequestException(
        'Contas WhatsApp com tenantId comercial não são suportadas no MVP; use tenantId null',
      );
    }
  }
}
