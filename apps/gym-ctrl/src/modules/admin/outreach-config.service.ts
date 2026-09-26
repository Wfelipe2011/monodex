import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Roles, WhatsappProvider } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { assertSuperAdminTenantWrite } from '@core/guard/bootstrap-write';
import { UpsertOutreachConfigDto } from './dto/upsert-outreach-config.dto';
import { UpsertTenantOutreachConfigDto } from './dto/upsert-tenant-outreach-config.dto';
import { PatchOutreachConfigDto } from './dto/patch-outreach-config.dto';
import { PatchPlatformOutreachConfigDto } from './dto/patch-platform-outreach-config.dto';
import { rejectForbiddenBodyKeys } from './reject-forbidden-body-keys';
import { eligibleOutreachCategories } from '@core/shared/eligible-outreach-categories';
import { asIntArray, cityAllowed } from '@core/shared/send-policy';

const TENANT_OWNED_OUTREACH_KEYS = ['enabled'] as const;

const PLATFORM_OUTREACH_KEYS = [
  'costPerLead',
  'costPerOnDemandSend',
  'cashbackOnReply',
  'coinDebitOnStatus',
  'whatsappAccountId',
] as const;

const RESOLVED_ACCOUNT_SELECT = {
  id: true,
  phoneNumberId: true,
  displayPhone: true,
  isDefault: true,
} as const;

type TenantReadiness = { id: number; phone: string | null; active: boolean };

@Injectable()
export class OutreachConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getEligibleCategories(tenantId: number) {
    await this.ensureTenant(tenantId);
    const { allowedCityIds, deniedCityIds } =
      await this.loadTenantCityPolicy(tenantId);
    const targets = await this.loadEnabledScrapeTargetsForCatalog();
    const categories = eligibleOutreachCategories({
      allowedCityIds,
      deniedCityIds,
      targets,
    });
    const items = targets
      .filter((target) =>
        cityAllowed(target.cityId, allowedCityIds, deniedCityIds),
      )
      .map((target) => ({
        category: target.category,
        cityId: target.cityId,
        cityName: target.city.name,
      }));
    return { categories, items };
  }

  async get(tenantId: number) {
    await this.ensureTenant(tenantId);
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new NotFoundException(
        `Outreach config do tenant ${tenantId} não encontrada`,
      );
    }
    const campaignCount = await this.prisma.tenantOutreachCampaign.count({
      where: { tenantId },
    });
    return {
      ...(await this.withResolvedWhatsappAccount(config)),
      campaignCount,
    };
  }

  async createBootstrap(
    tenantId: number,
    dto: UpsertOutreachConfigDto,
    roles: Roles[],
  ) {
    const tenant = await this.loadTenant(tenantId);
    const existing = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: { createdAt: true },
    });
    if (existing) {
      throw new ForbiddenException('Acesso não permitido');
    }
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: null,
      isPlatformField: false,
    });

    const enabled = dto.enabled ?? false;
    const cashbackOnReply = dto.cashbackOnReply ?? 0;

    await this.assertMasterEnableAllowed(tenant, {
      enabled,
      costPerLead: dto.costPerLead,
    });

    const whatsappAccountId = dto.whatsappAccountId ?? null;
    await this.assertAssignableWhatsappAccount(whatsappAccountId, tenantId);

    try {
      const created = await this.prisma.tenantOutreachConfig.create({
        data: {
          tenantId,
          enabled,
          costPerLead: dto.costPerLead,
          cashbackOnReply,
          whatsappAccountId,
        },
      });
      return this.withResolvedWhatsappAccount(created);
    } catch (error) {
      this.rethrowAssignedAccountUnique(error);
    }
  }

  async patchPlatform(
    tenantId: number,
    dto: PatchPlatformOutreachConfigDto,
    roles: Roles[],
    rawBody: unknown,
  ) {
    await this.loadTenant(tenantId);
    const existing = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Outreach config do tenant ${tenantId} não encontrada`,
      );
    }

    if (this.tenantOwnedKeysInBody(rawBody).length > 0) {
      assertSuperAdminTenantWrite({
        roles,
        resourceCreatedAt: existing.createdAt,
        isPlatformField: false,
      });
      throw new ForbiddenException('Acesso não permitido');
    }

    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: existing.createdAt,
      isPlatformField: true,
    });

    if (dto.whatsappAccountId !== undefined) {
      await this.assertAssignableWhatsappAccount(
        dto.whatsappAccountId,
        tenantId,
      );
    }

    if (existing.enabled && dto.costPerLead !== undefined) {
      const tenant = await this.loadTenant(tenantId);
      await this.assertMasterEnableAllowed(tenant, {
        enabled: true,
        costPerLead: dto.costPerLead,
      });
    }

    try {
      const updated = await this.prisma.tenantOutreachConfig.update({
        where: { tenantId },
        data: {
          ...(dto.costPerLead !== undefined
            ? { costPerLead: dto.costPerLead }
            : {}),
          ...(dto.costPerOnDemandSend !== undefined
            ? { costPerOnDemandSend: dto.costPerOnDemandSend }
            : {}),
          ...(dto.cashbackOnReply !== undefined
            ? { cashbackOnReply: dto.cashbackOnReply }
            : {}),
          ...(dto.coinDebitOnStatus !== undefined
            ? { coinDebitOnStatus: dto.coinDebitOnStatus }
            : {}),
          ...(dto.whatsappAccountId !== undefined
            ? { whatsappAccountId: dto.whatsappAccountId }
            : {}),
        },
      });
      return this.withResolvedWhatsappAccount(updated);
    } catch (error) {
      this.rethrowAssignedAccountUnique(error);
    }
  }

  async createTenant(
    tenantId: number,
    dto: UpsertTenantOutreachConfigDto,
    roles: Roles[],
    rawBody: unknown,
  ) {
    rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS);
    const tenant = await this.loadTenant(tenantId);
    const existing = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: { createdAt: true },
    });
    if (existing) {
      throw new ForbiddenException('Acesso não permitido');
    }
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: null,
      isPlatformField: false,
    });

    const enabled = dto.enabled ?? false;
    await this.assertMasterEnableAllowed(tenant, {
      enabled,
      costPerLead: 0,
    });

    const created = await this.prisma.tenantOutreachConfig.create({
      data: {
        tenantId,
        enabled,
        costPerLead: 0,
        costPerOnDemandSend: 0,
        cashbackOnReply: 0,
      },
    });
    return this.withResolvedWhatsappAccount(created);
  }

  async patchTenant(
    tenantId: number,
    dto: PatchOutreachConfigDto,
    roles: Roles[],
    rawBody: unknown,
  ) {
    rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS);
    const tenant = await this.loadTenant(tenantId);
    const existing = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      if (dto.enabled === true) {
        throw new BadRequestException(
          'Não é possível habilitar outreach sem config prévia; use PUT com campos obrigatórios',
        );
      }
      throw new NotFoundException(
        `Outreach config do tenant ${tenantId} não encontrada`,
      );
    }

    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: existing.createdAt,
      isPlatformField: false,
    });

    const mergedEnabled = dto.enabled ?? existing.enabled;
    await this.assertMasterEnableAllowed(tenant, {
      enabled: mergedEnabled,
      costPerLead: existing.costPerLead,
    });

    const updated = await this.prisma.tenantOutreachConfig.update({
      where: { tenantId },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
    return this.withResolvedWhatsappAccount(updated);
  }

  private async assertAssignableWhatsappAccount(
    id: number | null,
    tenantId: number,
  ): Promise<void> {
    if (id == null) {
      return;
    }

    const account = await this.prisma.whatsappAccount.findUnique({
      where: { id },
      include: {
        assignedOutreachConfig: { select: { tenantId: true } },
      },
    });

    if (!account) {
      throw new BadRequestException(`Conta WhatsApp ${id} não encontrada`);
    }
    if (account.tenantId != null) {
      throw new BadRequestException(
        `Conta WhatsApp ${id} não é uma conta de plataforma`,
      );
    }
    if (!account.enabled) {
      throw new BadRequestException(`Conta WhatsApp ${id} está desabilitada`);
    }
    if (account.provider !== WhatsappProvider.CLOUD_API) {
      throw new BadRequestException(
        `Conta WhatsApp ${id} não é Cloud API (provider=${account.provider})`,
      );
    }
    if (account.isDefault) {
      throw new BadRequestException(
        'Não é possível atribuir a conta default; use null para o remetente compartilhado',
      );
    }

    const assignedTenantId = account.assignedOutreachConfig?.tenantId;
    if (assignedTenantId != null && assignedTenantId !== tenantId) {
      throw new BadRequestException(
        `Conta WhatsApp ${id} já está atribuída a outro tenant`,
      );
    }
  }

  private async withResolvedWhatsappAccount<
    T extends { whatsappAccountId: number | null },
  >(config: T) {
    return {
      ...config,
      resolvedWhatsappAccount: await this.resolveAccountSummary(
        config.whatsappAccountId,
      ),
    };
  }

  private async resolveAccountSummary(whatsappAccountId: number | null) {
    if (whatsappAccountId != null) {
      return this.prisma.whatsappAccount.findUnique({
        where: { id: whatsappAccountId },
        select: RESOLVED_ACCOUNT_SELECT,
      });
    }

    return this.prisma.whatsappAccount.findFirst({
      where: {
        isDefault: true,
        tenantId: null,
        provider: WhatsappProvider.CLOUD_API,
      },
      select: RESOLVED_ACCOUNT_SELECT,
    });
  }

  private rethrowAssignedAccountUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'Número WhatsApp já atribuído a outro tenant',
      );
    }
    throw error;
  }

  private tenantOwnedKeysInBody(raw: unknown): string[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return [];
    }
    const keys = Object.keys(raw as Record<string, unknown>);
    return TENANT_OWNED_OUTREACH_KEYS.filter((k) => keys.includes(k));
  }

  private async loadTenantCityPolicy(tenantId: number) {
    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
      select: { allowedCityIds: true, deniedCityIds: true },
    });
    return {
      allowedCityIds: asIntArray(policy?.allowedCityIds),
      deniedCityIds: asIntArray(policy?.deniedCityIds),
    };
  }

  private async loadEnabledScrapeTargetsForCatalog() {
    return this.prisma.scrapeTarget.findMany({
      where: { enabled: true },
      select: {
        cityId: true,
        category: true,
        enabled: true,
        city: { select: { name: true } },
      },
      orderBy: [{ category: 'asc' }, { city: { name: 'asc' } }],
    });
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }

  private async loadTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, phone: true, active: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
    return tenant;
  }

  private async assertMasterEnableAllowed(
    tenant: TenantReadiness,
    fields: { enabled: boolean; costPerLead: number },
  ) {
    if (!fields.enabled) return;

    if (!tenant.active) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: tenant inativo (active=false)',
      );
    }
    if (!tenant.phone?.trim()) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: tenant sem phone preenchido',
      );
    }
    if (!(fields.costPerLead > 0)) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: costPerLead deve ser > 0',
      );
    }
  }
}
