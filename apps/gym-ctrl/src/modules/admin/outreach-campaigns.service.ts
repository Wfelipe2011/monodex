import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Roles } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { assertSuperAdminTenantWrite } from '@core/guard/bootstrap-write';
import { eligibleOutreachCategories } from '@core/shared/eligible-outreach-categories';
import {
  assertCampaignCityAllowed,
  asIntArray,
} from '@core/shared/send-policy';
import { assertTemplateGranted } from './assert-template-grant';
import { UpsertOutreachCampaignDto } from './dto/upsert-outreach-campaign.dto';
import { PatchOutreachCampaignDto } from './dto/patch-outreach-campaign.dto';
import {
  assertSlotBindingsValid,
  persistedSlotKeys,
  SlotBindingInput,
  SlotBindingsInput,
} from './slot-bindings.validate';

const TEMPLATE_MIN_SELECT = {
  id: true,
  name: true,
  language: true,
  status: true,
} as const;

const CAMPAIGN_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  enabled: true,
  schedule: true,
  categories: true,
  leadsPerRun: true,
  sendIntervalSeconds: true,
  outreachTemplateId: true,
  notifyTemplateId: true,
  slotBindings: true,
  cityId: true,
  createdAt: true,
  updatedAt: true,
  outreachTemplate: { select: TEMPLATE_MIN_SELECT },
  notifyTemplate: { select: TEMPLATE_MIN_SELECT },
} satisfies Prisma.TenantOutreachCampaignSelect;

type CampaignFields = {
  enabled: boolean;
  outreachTemplateId: number | null;
  notifyTemplateId: number | null;
  slotBindings: SlotBindingsInput;
};

@Injectable()
export class OutreachCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(tenantId: number) {
    await this.ensureTenant(tenantId);
    return this.prisma.tenantOutreachCampaign.findMany({
      where: { tenantId },
      select: CAMPAIGN_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async getCampaign(tenantId: number, campaignId: number) {
    return this.getCampaignOrThrow(tenantId, campaignId);
  }

  async createCampaign(
    tenantId: number,
    dto: UpsertOutreachCampaignDto,
    roles: Roles[],
  ) {
    await this.ensureTenant(tenantId);
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: null,
      isPlatformField: false,
    });

    const fields = this.normalizeCampaignInput(dto);
    await this.assertTemplateIdsGranted(tenantId, {
      outreachTemplateId: fields.outreachTemplateId,
      notifyTemplateId: fields.notifyTemplateId,
    });
    await this.assertTenantCategoriesValid(tenantId, dto.categories);
    await this.assertCityIdAllowed(tenantId, dto.cityId ?? null);
    await this.assertEnableAllowed(tenantId, fields);

    return this.prisma.tenantOutreachCampaign.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        enabled: fields.enabled,
        outreachTemplateId: fields.outreachTemplateId,
        notifyTemplateId: fields.notifyTemplateId,
        slotBindings: fields.slotBindings as unknown as Prisma.InputJsonValue,
        schedule: dto.schedule as Prisma.InputJsonValue,
        categories: dto.categories as Prisma.InputJsonValue,
        leadsPerRun: dto.leadsPerRun ?? 5,
        sendIntervalSeconds: dto.sendIntervalSeconds ?? 5,
        cityId: dto.cityId ?? null,
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async patchCampaign(
    tenantId: number,
    campaignId: number,
    dto: PatchOutreachCampaignDto,
    roles: Roles[],
  ) {
    const existing = await this.getCampaignOrThrow(tenantId, campaignId);
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

    const merged: CampaignFields = {
      enabled: dto.enabled ?? existing.enabled,
      outreachTemplateId,
      notifyTemplateId,
      slotBindings,
    };

    await this.assertTemplateIdsGranted(tenantId, {
      outreachTemplateId: dto.outreachTemplateId,
      notifyTemplateId: dto.notifyTemplateId,
    });

    if (dto.categories !== undefined) {
      await this.assertTenantCategoriesValid(tenantId, dto.categories);
    }

    const nextCityId =
      dto.cityId !== undefined ? dto.cityId : existing.cityId;
    if (dto.cityId !== undefined) {
      await this.assertCityIdAllowed(tenantId, nextCityId);
    }

    await this.assertEnableAllowed(tenantId, merged);

    return this.prisma.tenantOutreachCampaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.outreachTemplateId !== undefined
          ? { outreachTemplateId: dto.outreachTemplateId }
          : {}),
        ...(dto.notifyTemplateId !== undefined
          ? { notifyTemplateId: dto.notifyTemplateId }
          : {}),
        ...(dto.slotBindings !== undefined
          ? {
              slotBindings:
                slotBindings as unknown as Prisma.InputJsonValue,
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
        ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async deleteCampaign(tenantId: number, campaignId: number, roles: Roles[]) {
    const existing = await this.getCampaignOrThrow(tenantId, campaignId);
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: existing.createdAt,
      isPlatformField: false,
    });
    await this.prisma.tenantOutreachCampaign.delete({
      where: { id: campaignId },
    });
    return { ok: true as const };
  }

  private normalizeCampaignInput(
    dto: UpsertOutreachCampaignDto,
  ): CampaignFields & { enabled: boolean } {
    const leadsPerRun = dto.leadsPerRun ?? 5;
    const sendIntervalSeconds = dto.sendIntervalSeconds ?? 5;
    if (leadsPerRun < 1) {
      throw new BadRequestException('leadsPerRun deve ser ≥ 1');
    }
    if (sendIntervalSeconds < 0) {
      throw new BadRequestException('sendIntervalSeconds deve ser ≥ 0');
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('name é obrigatório');
    }

    return {
      enabled: dto.enabled ?? false,
      outreachTemplateId: dto.outreachTemplateId ?? null,
      notifyTemplateId: dto.notifyTemplateId ?? null,
      slotBindings: assertSlotBindingsValid(
        dto.slotBindings ?? { outreach: {}, notify: {} },
      ),
    };
  }

  private async assertCityIdAllowed(
    tenantId: number,
    cityId: number | null,
  ): Promise<void> {
    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
      select: { allowedCityIds: true, deniedCityIds: true },
    });
    assertCampaignCityAllowed(cityId, {
      allowedCityIds: policy?.allowedCityIds ?? [],
      deniedCityIds: policy?.deniedCityIds ?? [],
    });
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

  private async assertEnableAllowed(tenantId: number, fields: CampaignFields) {
    if (!fields.enabled) return;

    if (fields.outreachTemplateId == null || fields.notifyTemplateId == null) {
      throw new BadRequestException(
        'Não é possível habilitar campanha: outreachTemplateId e notifyTemplateId são obrigatórios',
      );
    }

    await this.assertTemplateIdsGranted(tenantId, {
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
        `Não é possível habilitar campanha: template ${fields.outreachTemplateId} não encontrado`,
      );
    }
    if (!notifyTemplate) {
      throw new BadRequestException(
        `Não é possível habilitar campanha: template ${fields.notifyTemplateId} não encontrado`,
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
        `Não é possível habilitar campanha: template ${role} deve estar APPROVED (status=${status})`,
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
          `Não é possível habilitar campanha: slotBindings.${role} omite ${key}`,
        );
      }
      if (binding.type === 'literal' || binding.type === 'header_image') {
        if (!(binding.value ?? '').trim()) {
          throw new BadRequestException(
            `Não é possível habilitar campanha: slotBindings.${role}.${key} exige value`,
          );
        }
      }
    }
  }

  private async tenantCategoryAllowList(tenantId: number): Promise<Set<string>> {
    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
      select: { allowedCityIds: true, deniedCityIds: true },
    });
    const allowedCityIds = asIntArray(policy?.allowedCityIds);
    const deniedCityIds = asIntArray(policy?.deniedCityIds);
    const targets = await this.prisma.scrapeTarget.findMany({
      where: { enabled: true },
      select: { cityId: true, category: true, enabled: true },
    });
    return new Set(
      eligibleOutreachCategories({
        allowedCityIds,
        deniedCityIds,
        targets,
      }),
    );
  }

  private async assertTenantCategoriesValid(
    tenantId: number,
    categories: string[],
  ): Promise<void> {
    const allowList = await this.tenantCategoryAllowList(tenantId);
    const invalid = categories.filter((c) => !allowList.has(c));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Categorias inválidas: ${invalid.join(', ')}`,
      );
    }
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

  private async getCampaignOrThrow(tenantId: number, campaignId: number) {
    await this.ensureTenant(tenantId);
    const campaign = await this.prisma.tenantOutreachCampaign.findFirst({
      where: { id: campaignId, tenantId },
      select: CAMPAIGN_SELECT,
    });
    if (!campaign) {
      throw new NotFoundException(
        `Campanha id=${campaignId} não encontrada para tenant ${tenantId}`,
      );
    }
    return campaign;
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
