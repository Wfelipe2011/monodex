import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  OnDemandSendSource,
  Prisma,
  WhatsappConversationDirection,
  WhatsappDeliveryStatus,
} from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  computeAvailableBalance,
  pendingUnchargedCityWhere,
  pendingUnchargedListSendsWhere,
  pendingUnchargedOnDemandWhere,
} from '@core/shared/on-demand-balance';
import { isDedicatedPlatformAccount } from '@core/shared/whatsapp-conversation';
import {
  BINDING_TYPES,
  BindingLeadContext,
  BindingType,
  normalizeBrazilPhoneDigits,
  resolveBindingValue,
} from '@core/shared/whatsapp-template-bindings';
import { buildTemplateSendBody } from '@core/shared/whatsapp-template-payload';
import {
  parseTemplateSlots,
  TemplateSlot,
} from '@core/shared/whatsapp-template-slots';
import { CreateOnDemandSendDto } from './dto/create-on-demand-send.dto';
import { MediaService } from './media.service';
import { PlatformWhatsappAdminService } from './platform-whatsapp-admin.service';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);

type GraphSendResponse = {
  messaging_product?: string;
  contacts?: { input?: string; wa_id?: string }[];
  messages?: { id?: string; message_status?: string }[];
};

export type OnDemandSendAuth = {
  authKind?: 'jwt' | 'api_key';
  apiKeyId?: number;
};

@Injectable()
export class OnDemandSendsService {
  private readonly logger = new Logger(OnDemandSendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappAdminService,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    tenantId: number,
    templateId: number,
    dto: CreateOnDemandSendDto,
    auth: OnDemandSendAuth,
  ) {
    await this.assertTenantExists(tenantId);

    const outreach = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: {
        costPerOnDemandSend: true,
        costPerLead: true,
        whatsappAccountId: true,
        whatsappAccount: { select: { isDefault: true } },
      },
    });

    const costPerOnDemandSend = outreach?.costPerOnDemandSend ?? 0;
    if (costPerOnDemandSend <= 0) {
      throw new BadRequestException(
        'costPerOnDemandSend deve ser > 0 para envio on-demand',
      );
    }

    if (
      outreach?.whatsappAccountId == null ||
      !outreach.whatsappAccount ||
      !isDedicatedPlatformAccount(outreach.whatsappAccount)
    ) {
      throw new BadRequestException('Tenant sem número WhatsApp dedicado');
    }

    const grant = await this.prisma.tenantTemplateGrant.findUnique({
      where: {
        tenantId_templateId: { tenantId, templateId },
      },
      include: { template: true },
    });
    if (!grant) {
      throw new NotFoundException(
        `Template id=${templateId} não concedido ao tenant ${tenantId}`,
      );
    }
    const template = grant.template;
    if (template.status.toUpperCase() !== 'APPROVED') {
      throw new BadRequestException(
        `Template id=${templateId} não está APPROVED (status=${template.status})`,
      );
    }

    let leadCtx: BindingLeadContext | null = null;
    let leadName: string | null = null;
    if (dto.leadId != null) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        include: { city: true },
      });
      if (!lead) {
        throw new NotFoundException(`Lead id=${dto.leadId} não encontrado`);
      }
      leadName = lead.name;
      leadCtx = {
        name: lead.name,
        phone: lead.phone,
        cityName: lead.city?.name ?? null,
        category: lead.category,
        rating: lead.rating,
      };
    }

    const slots = this.asSlots(template.slots, template.components);
    const variables = dto.variables ?? {};
    const { values, mediaId } = await this.resolveSlotValues(
      tenantId,
      slots,
      variables,
      dto.imageId,
      leadCtx,
    );

    const to = normalizeBrazilPhoneDigits(dto.to);
    if (!to || to === '—') {
      throw new BadRequestException('Telefone de destino inválido');
    }

    await this.assertAvailableBalance(tenantId, costPerOnDemandSend, outreach.costPerLead ?? 0);

    const creds = await this.platformWhatsapp.resolveCredentials(tenantId);
    const sendBody = buildTemplateSendBody({
      name: template.name,
      language: template.language,
      slots,
      values,
    });
    const graphPayload = {
      ...sendBody,
      recipient_type: 'individual' as const,
      to,
    };

    this.logger.log(
      `on-demand-send tenant=${tenantId} templateId=${templateId} to=${to} source=${auth.authKind ?? 'jwt'}`,
    );

    let wamid: string;
    let messageStatus: string | null = null;
    try {
      const res = await this.httpService.axiosRef.post<GraphSendResponse>(
        creds.messagesUrl,
        graphPayload,
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      wamid = res.data.messages?.[0]?.id ?? '';
      messageStatus = res.data.messages?.[0]?.message_status ?? null;
    } catch (error) {
      this.rethrowGraphError(error);
    }

    if (!wamid) {
      throw new BadGatewayException('Graph API não retornou wamid');
    }

    const phone = normalizeListPhone(to);
    const source: OnDemandSendSource =
      auth.authKind === 'api_key'
        ? OnDemandSendSource.API_KEY
        : OnDemandSendSource.ADMIN_JWT;

    const conversationId = await this.persistConversation({
      tenantId,
      phone,
      wamid,
      templateName: template.name,
      graphPayload,
      leadName,
    });

    const send = await this.prisma.tenantOnDemandSend.create({
      data: {
        tenantId,
        templateId,
        phone,
        wamid,
        variables: values as Prisma.InputJsonValue,
        mediaId: mediaId ?? null,
        source,
        apiKeyId: auth.authKind === 'api_key' ? (auth.apiKeyId ?? null) : null,
        conversationId,
        coinDebitedAt: null,
      },
      select: {
        id: true,
        wamid: true,
        phone: true,
        templateId: true,
        conversationId: true,
        coinDebitedAt: true,
        sentAt: true,
      },
    });

    return {
      id: send.id,
      wamid: send.wamid,
      to: send.phone,
      messageStatus,
      conversationId: send.conversationId,
    };
  }

  async list(tenantId: number) {
    await this.assertTenantExists(tenantId);
    const rows = await this.prisma.tenantOnDemandSend.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: {
        id: true,
        wamid: true,
        phone: true,
        templateId: true,
        lastStatus: true,
        sentAt: true,
        conversationId: true,
        statuses: {
          where: { status: WhatsappDeliveryStatus.failed },
          orderBy: { metaTimestamp: 'desc' },
          take: 1,
          select: { errors: true, status: true },
        },
      },
    });
    return rows.map((row) => this.toStatusPayload(row));
  }

  async getById(tenantId: number, sendId: number) {
    await this.assertTenantExists(tenantId);
    const row = await this.prisma.tenantOnDemandSend.findFirst({
      where: { id: sendId, tenantId },
      select: {
        id: true,
        wamid: true,
        phone: true,
        templateId: true,
        lastStatus: true,
        sentAt: true,
        conversationId: true,
        statuses: {
          where: { status: WhatsappDeliveryStatus.failed },
          orderBy: { metaTimestamp: 'desc' },
          take: 1,
          select: { errors: true, status: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(
        `On-demand send id=${sendId} não encontrado para tenant ${tenantId}`,
      );
    }
    return this.toStatusPayload(row);
  }

  private toStatusPayload(row: {
    id: number;
    wamid: string;
    phone: string;
    templateId: number;
    lastStatus: WhatsappDeliveryStatus | null;
    sentAt: Date;
    conversationId: number | null;
    statuses: Array<{ errors: Prisma.JsonValue; status: WhatsappDeliveryStatus }>;
  }) {
    const latestError =
      row.lastStatus === WhatsappDeliveryStatus.failed
        ? extractLatestError(row.statuses[0]?.errors)
        : null;
    return {
      id: row.id,
      wamid: row.wamid,
      phone: row.phone,
      templateId: row.templateId,
      lastStatus: row.lastStatus,
      sentAt: row.sentAt,
      conversationId: row.conversationId,
      latestError,
    };
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

  private async assertAvailableBalance(
    tenantId: number,
    costPerOnDemandSend: number,
    costPerLead: number,
  ) {
    const coin = await this.prisma.coin.findFirst({
      where: { tenantId },
      select: { balance: true },
    });
    const balance = coin?.balance ?? 0;

    const [pendingCity, pendingOnDemand, lists] = await Promise.all([
      this.prisma.tenantLead.count({
        where: pendingUnchargedCityWhere(tenantId),
      }),
      this.prisma.tenantOnDemandSend.count({
        where: pendingUnchargedOnDemandWhere(tenantId),
      }),
      this.prisma.tenantLeadList.findMany({
        where: { tenantId },
        select: { id: true, costPerSend: true },
      }),
    ]);

    let pendingListAmount = 0;
    for (const list of lists) {
      const pending = await this.prisma.tenantListSend.count({
        where: pendingUnchargedListSendsWhere(list.id),
      });
      pendingListAmount += pending * list.costPerSend;
    }

    const available = computeAvailableBalance({
      balance,
      pendingCity,
      costPerLead,
      pendingListAmount,
      pendingOnDemand,
      costPerOnDemandSend,
    });

    if (available < costPerOnDemandSend) {
      throw new BadRequestException(
        `Saldo disponível insuficiente (available=${available}, cost=${costPerOnDemandSend})`,
      );
    }
  }

  private async persistConversation(input: {
    tenantId: number;
    phone: string;
    wamid: string;
    templateName: string;
    graphPayload: Record<string, unknown>;
    leadName: string | null;
  }): Promise<number> {
    const trimmedLeadName = input.leadName?.trim() ?? '';
    const displayName =
      trimmedLeadName.length > 0 ? trimmedLeadName : input.phone;
    const now = new Date();

    const conversation = await this.prisma.whatsappConversation.upsert({
      where: {
        tenantId_phone: { tenantId: input.tenantId, phone: input.phone },
      },
      create: {
        tenantId: input.tenantId,
        phone: input.phone,
        displayName,
        lastMessageAt: now,
      },
      update: { lastMessageAt: now },
    });

    await this.prisma.whatsappConversationMessage.create({
      data: {
        wamid: input.wamid,
        direction: WhatsappConversationDirection.OUT,
        type: 'template',
        body: input.templateName,
        raw: input.graphPayload as Prisma.InputJsonValue,
        phone: input.phone,
        tenantId: input.tenantId,
        conversationId: conversation.id,
      },
    });

    return conversation.id;
  }

  private asSlots(slotsJson: unknown, components: unknown): TemplateSlot[] {
    if (Array.isArray(slotsJson) && slotsJson.length > 0) {
      return slotsJson as TemplateSlot[];
    }
    return parseTemplateSlots(components);
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

function extractLatestError(errors: Prisma.JsonValue | undefined): string | null {
  if (errors == null) {
    return null;
  }
  if (typeof errors === 'string') {
    return errors;
  }
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const msg = (first as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) {
        return msg;
      }
    }
    return JSON.stringify(first);
  }
  if (typeof errors === 'object') {
    const msg = (errors as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
    return JSON.stringify(errors);
  }
  return String(errors);
}
