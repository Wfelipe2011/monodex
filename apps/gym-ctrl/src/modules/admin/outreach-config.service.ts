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
import { assertTemplateGranted } from './assert-template-grant';
import { rejectForbiddenBodyKeys } from './reject-forbidden-body-keys';
import {
  assertSlotBindingsValid,
  persistedSlotKeys,
  SlotBindingInput,
  SlotBindingsInput,
} from './slot-bindings.validate';

const TENANT_OWNED_OUTREACH_KEYS = [
  'enabled',
  'schedule',
  'categories',
  'leadsPerRun',
  'sendIntervalSeconds',
  'slotBindings',
  'outreachTemplateId',
  'notifyTemplateId',
] as const;

const PLATFORM_OUTREACH_KEYS = [
  'costPerLead',
  'cashbackOnReply',
  'whatsappAccountId',
] as const;

const RESOLVED_ACCOUNT_SELECT = {
  id: true,
  phoneNumberId: true,
  displayPhone: true,
  isDefault: true,
} as const;

const TEMPLATE_MIN_SELECT = {
  id: true,
  name: true,
  language: true,
  status: true,
} as const;

const CONFIG_INCLUDE = {
  outreachTemplate: { select: TEMPLATE_MIN_SELECT },
  notifyTemplate: { select: TEMPLATE_MIN_SELECT },
} as const;

type TenantReadiness = { id: number; phone: string | null; active: boolean };

@Injectable()
export class OutreachConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: number) {
    await this.ensureTenant(tenantId);
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      include: CONFIG_INCLUDE,
    });
    if (!config) {
      throw new NotFoundException(
        `Outreach config do tenant ${tenantId} não encontrada`,
      );
    }
    return this.withResolvedWhatsappAccount(config);
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
    const slotBindings = assertSlotBindingsValid(dto.slotBindings);

    await this.assertTemplateIdsGranted(tenantId, {
      outreachTemplateId: dto.outreachTemplateId,
      notifyTemplateId: dto.notifyTemplateId,
    });
    await this.assertEnableAllowed(tenant, {
      enabled,
      costPerLead: dto.costPerLead,
      outreachTemplateId: dto.outreachTemplateId,
      notifyTemplateId: dto.notifyTemplateId,
      slotBindings,
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
          outreachTemplateId: dto.outreachTemplateId,
          notifyTemplateId: dto.notifyTemplateId,
          whatsappAccountId,
          slotBindings: slotBindings as unknown as Prisma.InputJsonValue,
          schedule: dto.schedule as Prisma.InputJsonValue,
          categories: dto.categories as Prisma.InputJsonValue,
          leadsPerRun: dto.leadsPerRun ?? 5,
          sendIntervalSeconds: dto.sendIntervalSeconds ?? 5,
        },
        include: CONFIG_INCLUDE,
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

    try {
      const updated = await this.prisma.tenantOutreachConfig.update({
        where: { tenantId },
        data: {
          ...(dto.costPerLead !== undefined
            ? { costPerLead: dto.costPerLead }
            : {}),
          ...(dto.cashbackOnReply !== undefined
            ? { cashbackOnReply: dto.cashbackOnReply }
            : {}),
          ...(dto.whatsappAccountId !== undefined
            ? { whatsappAccountId: dto.whatsappAccountId }
            : {}),
        },
        include: CONFIG_INCLUDE,
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
    const slotBindings = assertSlotBindingsValid(
      dto.slotBindings ?? { outreach: {}, notify: {} },
    );
    const outreachTemplateId = dto.outreachTemplateId ?? null;
    const notifyTemplateId = dto.notifyTemplateId ?? null;

    await this.assertTemplateIdsGranted(tenantId, {
      outreachTemplateId,
      notifyTemplateId,
    });
    await this.assertEnableAllowed(tenant, {
      enabled,
      costPerLead: 0,
      outreachTemplateId,
      notifyTemplateId,
      slotBindings,
    });

    const created = await this.prisma.tenantOutreachConfig.create({
      data: {
        tenantId,
        enabled,
        costPerLead: 0,
        cashbackOnReply: 0,
        outreachTemplateId,
        notifyTemplateId,
        slotBindings: slotBindings as unknown as Prisma.InputJsonValue,
        schedule: (dto.schedule ?? {}) as Prisma.InputJsonValue,
        categories: (dto.categories ?? []) as Prisma.InputJsonValue,
        leadsPerRun: dto.leadsPerRun ?? 5,
        sendIntervalSeconds: dto.sendIntervalSeconds ?? 5,
      },
      include: CONFIG_INCLUDE,
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

    const slotBindings =
      dto.slotBindings !== undefined
        ? assertSlotBindingsValid(dto.slotBindings)
        : this.asSlotBindings(existing.slotBindings);

    const outreachTemplateId =
      dto.outreachTemplateId !== undefined
        ? dto.outreachTemplateId
        : existing.outreachTemplateId;
    const notifyTemplateId =
      dto.notifyTemplateId !== undefined
        ? dto.notifyTemplateId
        : existing.notifyTemplateId;

    await this.assertTemplateIdsGranted(tenantId, {
      outreachTemplateId: dto.outreachTemplateId,
      notifyTemplateId: dto.notifyTemplateId,
    });

    const merged = {
      enabled: dto.enabled ?? existing.enabled,
      costPerLead: existing.costPerLead,
      outreachTemplateId,
      notifyTemplateId,
      slotBindings,
    };

    await this.assertEnableAllowed(tenant, merged);

    const updated = await this.prisma.tenantOutreachConfig.update({
      where: { tenantId },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.outreachTemplateId !== undefined
          ? { outreachTemplateId: dto.outreachTemplateId }
          : {}),
        ...(dto.notifyTemplateId !== undefined
          ? { notifyTemplateId: dto.notifyTemplateId }
          : {}),
        ...(dto.slotBindings !== undefined
          ? {
              slotBindings: slotBindings as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.schedule !== undefined
          ? { schedule: dto.schedule as Prisma.InputJsonValue }
          : {}),
        ...(dto.categories !== undefined
          ? { categories: dto.categories as Prisma.InputJsonValue }
          : {}),
        ...(dto.leadsPerRun !== undefined
          ? { leadsPerRun: dto.leadsPerRun }
          : {}),
        ...(dto.sendIntervalSeconds !== undefined
          ? { sendIntervalSeconds: dto.sendIntervalSeconds }
          : {}),
      },
      include: CONFIG_INCLUDE,
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

  private asSlotBindings(raw: Prisma.JsonValue): SlotBindingsInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { outreach: {}, notify: {} };
    }
    const rec = raw as Record<string, unknown>;
    const outreach = isRecord(rec.outreach)
      ? (rec.outreach as Record<string, SlotBindingInput>)
      : {};
    const notify = isRecord(rec.notify)
      ? (rec.notify as Record<string, SlotBindingInput>)
      : {};
    return { outreach, notify };
  }

  private async assertTemplateIdsGranted(
    tenantId: number,
    ids: {
      outreachTemplateId?: number | null;
      notifyTemplateId?: number | null;
    },
  ) {
    await assertTemplateGranted(this.prisma, tenantId, ids.outreachTemplateId);
    await assertTemplateGranted(this.prisma, tenantId, ids.notifyTemplateId);
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

  private async assertEnableAllowed(
    tenant: TenantReadiness,
    fields: {
      enabled: boolean;
      costPerLead: number;
      outreachTemplateId: number | null;
      notifyTemplateId: number | null;
      slotBindings: SlotBindingsInput;
    },
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
    if (fields.outreachTemplateId == null || fields.notifyTemplateId == null) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: outreachTemplateId e notifyTemplateId são obrigatórios',
      );
    }

    await this.assertTemplateIdsGranted(tenant.id, {
      outreachTemplateId: fields.outreachTemplateId,
      notifyTemplateId: fields.notifyTemplateId,
    });

    const [outreachTemplate, notifyTemplate] = await Promise.all([
      this.prisma.whatsappMessageTemplate.findUnique({
        where: { id: fields.outreachTemplateId },
        select: { id: true, status: true, slots: true },
      }),
      this.prisma.whatsappMessageTemplate.findUnique({
        where: { id: fields.notifyTemplateId },
        select: { id: true, status: true, slots: true },
      }),
    ]);

    if (!outreachTemplate) {
      throw new BadRequestException(
        `Não é possível habilitar outreach: template ${fields.outreachTemplateId} não encontrado`,
      );
    }
    if (!notifyTemplate) {
      throw new BadRequestException(
        `Não é possível habilitar outreach: template ${fields.notifyTemplateId} não encontrado`,
      );
    }

    this.assertApproved('outreach', outreachTemplate.status);
    this.assertApproved('notify', notifyTemplate.status);
    this.assertSlotCoverage(
      'outreach',
      persistedSlotKeys(outreachTemplate.slots),
      fields.slotBindings.outreach,
    );
    this.assertSlotCoverage(
      'notify',
      persistedSlotKeys(notifyTemplate.slots),
      fields.slotBindings.notify,
    );
  }

  private assertApproved(role: string, status: string) {
    if (status.trim().toUpperCase() !== 'APPROVED') {
      throw new BadRequestException(
        `Não é possível habilitar outreach: template ${role} deve estar APPROVED (status=${status})`,
      );
    }
  }

  private assertSlotCoverage(
    role: 'outreach' | 'notify',
    requiredKeys: string[],
    bindings: Record<string, SlotBindingInput>,
  ) {
    for (const key of requiredKeys) {
      const binding = bindings[key];
      if (!binding) {
        throw new BadRequestException(
          `Não é possível habilitar outreach: slotBindings.${role} omite ${key}`,
        );
      }
      if (binding.type === 'literal' || binding.type === 'header_image') {
        if (!(binding.value ?? '').trim()) {
          throw new BadRequestException(
            `Não é possível habilitar outreach: slotBindings.${role}.${key} exige value`,
          );
        }
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
