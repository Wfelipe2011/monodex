import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { UpsertOutreachConfigDto } from './dto/upsert-outreach-config.dto';
import { PatchOutreachConfigDto } from './dto/patch-outreach-config.dto';

@Injectable()
export class OutreachConfigService {
  constructor(private readonly prisma: PrismaService) {}

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
    return config;
  }

  async upsert(tenantId: number, dto: UpsertOutreachConfigDto) {
    const tenant = await this.loadTenant(tenantId);
    const enabled = dto.enabled ?? false;
    const cashbackOnReply = dto.cashbackOnReply ?? 0;

    this.assertEnableAllowed(tenant, {
      enabled,
      costPerLead: dto.costPerLead,
      outreachTemplateName: dto.outreachTemplateName,
      notifyTenantTemplateName: dto.notifyTenantTemplateName,
    });

    return this.prisma.tenantOutreachConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enabled,
        costPerLead: dto.costPerLead,
        cashbackOnReply,
        outreachTemplateName: dto.outreachTemplateName,
        notifyTenantTemplateName: dto.notifyTenantTemplateName,
        schedule: dto.schedule as Prisma.InputJsonValue,
        categories: dto.categories as Prisma.InputJsonValue,
      },
      update: {
        enabled,
        costPerLead: dto.costPerLead,
        cashbackOnReply,
        outreachTemplateName: dto.outreachTemplateName,
        notifyTenantTemplateName: dto.notifyTenantTemplateName,
        schedule: dto.schedule as Prisma.InputJsonValue,
        categories: dto.categories as Prisma.InputJsonValue,
      },
    });
  }

  async patch(tenantId: number, dto: PatchOutreachConfigDto) {
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

    const merged = {
      enabled: dto.enabled ?? existing.enabled,
      costPerLead: dto.costPerLead ?? existing.costPerLead,
      cashbackOnReply: dto.cashbackOnReply ?? existing.cashbackOnReply,
      outreachTemplateName:
        dto.outreachTemplateName ?? existing.outreachTemplateName,
      notifyTenantTemplateName:
        dto.notifyTenantTemplateName ?? existing.notifyTenantTemplateName,
      schedule: (dto.schedule ?? existing.schedule) as Prisma.InputJsonValue,
      categories: (dto.categories ??
        existing.categories) as Prisma.InputJsonValue,
    };

    this.assertEnableAllowed(tenant, {
      enabled: merged.enabled,
      costPerLead: merged.costPerLead,
      outreachTemplateName: merged.outreachTemplateName,
      notifyTenantTemplateName: merged.notifyTenantTemplateName,
    });

    return this.prisma.tenantOutreachConfig.update({
      where: { tenantId },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.costPerLead !== undefined
          ? { costPerLead: dto.costPerLead }
          : {}),
        ...(dto.cashbackOnReply !== undefined
          ? { cashbackOnReply: dto.cashbackOnReply }
          : {}),
        ...(dto.outreachTemplateName !== undefined
          ? { outreachTemplateName: dto.outreachTemplateName }
          : {}),
        ...(dto.notifyTenantTemplateName !== undefined
          ? { notifyTenantTemplateName: dto.notifyTenantTemplateName }
          : {}),
        ...(dto.schedule !== undefined
          ? { schedule: dto.schedule as Prisma.InputJsonValue }
          : {}),
        ...(dto.categories !== undefined
          ? { categories: dto.categories as Prisma.InputJsonValue }
          : {}),
      },
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

  private assertEnableAllowed(
    tenant: { phone: string | null; active: boolean },
    fields: {
      enabled: boolean;
      costPerLead: number;
      outreachTemplateName: string;
      notifyTenantTemplateName: string;
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
    if (!fields.outreachTemplateName?.trim()) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: outreachTemplateName obrigatório',
      );
    }
    if (!fields.notifyTenantTemplateName?.trim()) {
      throw new BadRequestException(
        'Não é possível habilitar outreach: notifyTenantTemplateName obrigatório',
      );
    }
  }
}
