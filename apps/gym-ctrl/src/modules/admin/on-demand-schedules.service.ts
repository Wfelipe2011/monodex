import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnDemandScheduleStatus, Prisma, Roles } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  isSaoPauloHourInPast,
  parseSaoPauloHourToUtc,
} from '@core/shared/sao-paulo-time';
import {
  BINDING_TYPES,
  BindingLeadContext,
  BindingType,
  normalizeBrazilPhoneDigits,
  resolveBindingValue,
} from '@core/shared/whatsapp-template-bindings';
import {
  parseTemplateSlots,
  TemplateSlot,
} from '@core/shared/whatsapp-template-slots';
import { CreateOnDemandScheduleDto } from './dto/create-on-demand-schedule.dto';
import { MediaService } from './media.service';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);

export type ScheduleAuth = {
  roles?: Roles[];
};

@Injectable()
export class OnDemandSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    tenantId: number,
    dto: CreateOnDemandScheduleDto,
    auth: ScheduleAuth,
  ) {
    this.assertTenantAdminWrite(auth);
    await this.assertTenantExists(tenantId);

    let scheduledFor: Date;
    try {
      scheduledFor = parseSaoPauloHourToUtc(dto.scheduledFor);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'scheduledFor inválido',
      );
    }
    if (isSaoPauloHourInPast(scheduledFor)) {
      throw new BadRequestException(
        'scheduledFor no passado (hora atual em America/Sao_Paulo)',
      );
    }

    const outreach = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: { costPerOnDemandSend: true },
    });
    const costPerOnDemandSend = outreach?.costPerOnDemandSend ?? 0;
    if (costPerOnDemandSend <= 0) {
      throw new BadRequestException(
        'costPerOnDemandSend deve ser > 0 para agenda on-demand',
      );
    }

    const grant = await this.prisma.tenantTemplateGrant.findUnique({
      where: {
        tenantId_templateId: { tenantId, templateId: dto.templateId },
      },
      include: { template: true },
    });
    if (!grant) {
      throw new NotFoundException(
        `Template id=${dto.templateId} não concedido ao tenant ${tenantId}`,
      );
    }
    const template = grant.template;
    if (template.status.toUpperCase() !== 'APPROVED') {
      throw new BadRequestException(
        `Template id=${dto.templateId} não está APPROVED (status=${template.status})`,
      );
    }

    let leadCtx: BindingLeadContext | null = null;
    if (dto.leadId != null) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        include: { city: true },
      });
      if (!lead) {
        throw new NotFoundException(`Lead id=${dto.leadId} não encontrado`);
      }
      leadCtx = {
        name: lead.name,
        phone: lead.phone,
        cityName: lead.city?.name ?? null,
        category: lead.category,
        rating: lead.rating,
      };
    }

    const slots = this.asSlots(template.slots, template.components);
    const { values, mediaId } = await this.resolveSlotValues(
      tenantId,
      slots,
      dto.variables ?? {},
      dto.imageId,
      leadCtx,
    );

    const to = normalizeBrazilPhoneDigits(dto.to);
    if (!to || to === '—') {
      throw new BadRequestException('Telefone de destino inválido');
    }
    const phone = normalizeListPhone(to);

    const row = await this.prisma.tenantOnDemandSchedule.create({
      data: {
        tenantId,
        templateId: dto.templateId,
        phone,
        scheduledFor,
        variables: values as Prisma.InputJsonValue,
        mediaId: mediaId ?? null,
        leadId: dto.leadId ?? null,
        status: OnDemandScheduleStatus.PENDING,
      },
      select: {
        id: true,
        tenantId: true,
        templateId: true,
        phone: true,
        scheduledFor: true,
        status: true,
        mediaId: true,
        leadId: true,
        createdAt: true,
      },
    });

    return this.toPayload(row);
  }

  async list(tenantId: number) {
    await this.assertTenantExists(tenantId);
    const rows = await this.prisma.tenantOnDemandSchedule.findMany({
      where: { tenantId },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
      select: {
        id: true,
        tenantId: true,
        templateId: true,
        phone: true,
        scheduledFor: true,
        status: true,
        failedReason: true,
        onDemandSendId: true,
        mediaId: true,
        leadId: true,
        cancelledAt: true,
        createdAt: true,
      },
    });
    return rows.map((row) => this.toPayload(row));
  }

  async getById(tenantId: number, scheduleId: number) {
    await this.assertTenantExists(tenantId);
    const row = await this.prisma.tenantOnDemandSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      select: {
        id: true,
        tenantId: true,
        templateId: true,
        phone: true,
        scheduledFor: true,
        status: true,
        failedReason: true,
        onDemandSendId: true,
        mediaId: true,
        leadId: true,
        cancelledAt: true,
        createdAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException(
        `Agenda id=${scheduleId} não encontrada para tenant ${tenantId}`,
      );
    }
    return this.toPayload(row);
  }

  async cancel(tenantId: number, scheduleId: number, auth: ScheduleAuth) {
    this.assertTenantAdminWrite(auth);
    await this.assertTenantExists(tenantId);

    const existing = await this.prisma.tenantOnDemandSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Agenda id=${scheduleId} não encontrada para tenant ${tenantId}`,
      );
    }
    if (existing.status !== OnDemandScheduleStatus.PENDING) {
      throw new ConflictException(
        `Só é possível cancelar agenda PENDING (status=${existing.status})`,
      );
    }

    const updated = await this.prisma.tenantOnDemandSchedule.updateMany({
      where: {
        id: scheduleId,
        tenantId,
        status: OnDemandScheduleStatus.PENDING,
      },
      data: {
        status: OnDemandScheduleStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Agenda não está mais PENDING (claim concorrente)',
      );
    }

    return this.getById(tenantId, scheduleId);
  }

  private toPayload(row: {
    id: number;
    tenantId: number;
    templateId: number;
    phone: string;
    scheduledFor: Date;
    status: OnDemandScheduleStatus;
    failedReason?: string | null;
    onDemandSendId?: number | null;
    mediaId?: number | null;
    leadId?: number | null;
    cancelledAt?: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      templateId: row.templateId,
      phone: row.phone,
      scheduledFor: row.scheduledFor.toISOString(),
      status: row.status,
      failedReason: row.failedReason ?? null,
      onDemandSendId: row.onDemandSendId ?? null,
      mediaId: row.mediaId ?? null,
      leadId: row.leadId ?? null,
      cancelledAt: row.cancelledAt ?? null,
      createdAt: row.createdAt,
    };
  }

  private assertTenantAdminWrite(auth: ScheduleAuth) {
    if (auth.roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
  }

  private async assertTenantExists(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }

  private async resolveSlotValues(
    tenantId: number,
    slots: TemplateSlot[],
    variables: Record<string, string>,
    imageId: string | undefined,
    leadCtx: BindingLeadContext | null,
  ): Promise<{ values: Record<string, string>; mediaId: number | null }> {
    const values: Record<string, string> = {};
    const missing: string[] = [];
    let mediaId: number | null = null;

    for (const slot of slots) {
      const isImage =
        slot.paramType === 'image' || slot.key === 'header.image';

      if (isImage) {
        const fromVar = variables[slot.key]?.trim() ?? '';
        if (fromVar.length > 0) {
          values[slot.key] = fromVar;
          continue;
        }
        if (!imageId?.trim()) {
          missing.push(slot.key);
          continue;
        }
        const media = await this.mediaService.findOwnedByPublicId(
          tenantId,
          imageId.trim(),
        );
        if (!media) {
          throw new NotFoundException(
            `Mídia imageId=${imageId} não encontrada para o tenant`,
          );
        }
        values[slot.key] = this.mediaService.publicUrl(media.publicId);
        mediaId = media.id;
        continue;
      }

      const resolved = this.resolveTextSlotValue(slot, variables, leadCtx);
      if (!resolved) {
        missing.push(slot.key);
      } else {
        values[slot.key] = resolved;
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Slots obrigatórios sem valor: ${missing.join(', ')}`,
      );
    }

    return { values, mediaId };
  }

  private resolveTextSlotValue(
    slot: TemplateSlot,
    variables: Record<string, string>,
    lead: BindingLeadContext | null,
  ): string {
    const raw = variables[slot.key];
    const ctx = { lead, now: new Date() };

    if (raw != null && String(raw).trim() !== '') {
      const trimmed = String(raw).trim();
      if (BINDING_TYPE_SET.has(trimmed)) {
        return resolveBindingValue({ type: trimmed as BindingType }, ctx);
      }
      return trimmed;
    }

    const implicit = this.implicitBindingType(slot);
    if (!implicit) {
      return '';
    }
    if (implicit.startsWith('lead.') && !lead) {
      return '';
    }
    if (implicit.startsWith('tenant.')) {
      return '';
    }
    return resolveBindingValue({ type: implicit }, ctx);
  }

  private implicitBindingType(slot: TemplateSlot): BindingType | null {
    const candidates = [slot.key, slot.parameterName ?? ''];
    for (const candidate of candidates) {
      if (BINDING_TYPE_SET.has(candidate)) {
        return candidate as BindingType;
      }
      const suffix = candidate.includes('.')
        ? candidate.slice(candidate.indexOf('.') + 1)
        : candidate;
      if (
        (suffix.startsWith('now.') || suffix.startsWith('lead.')) &&
        BINDING_TYPE_SET.has(suffix)
      ) {
        return suffix as BindingType;
      }
    }
    return null;
  }

  private asSlots(slotsJson: unknown, components: unknown): TemplateSlot[] {
    if (Array.isArray(slotsJson) && slotsJson.length > 0) {
      return slotsJson as TemplateSlot[];
    }
    return parseTemplateSlots(components);
  }
}
