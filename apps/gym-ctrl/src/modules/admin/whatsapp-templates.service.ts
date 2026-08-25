import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma, WhatsappConversationDirection } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
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
  resolveTemplateSlots,
  toTemplatePreviewDto,
} from '@core/shared/whatsapp-template-preview';
import {
  parseTemplateSlots,
  TemplateSlot,
} from '@core/shared/whatsapp-template-slots';
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { PatchWhatsappTemplateDto } from './dto/patch-whatsapp-template.dto';
import { TestWhatsappTemplateDto } from './dto/test-whatsapp-template.dto';
import { assertValidMarketingTemplateComponents } from './whatsapp-template-components.validation';
import {
  GRAPH_API_VERSION,
  PlatformWhatsappAdminService,
} from './platform-whatsapp-admin.service';

const BINDING_TYPE_SET = new Set<string>(BINDING_TYPES);

type GraphTemplatePage = {
  data?: GraphTemplate[];
  paging?: { next?: string };
};

type GraphTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  parameter_format?: string;
  components?: unknown;
};

type GraphSendResponse = {
  messaging_product?: string;
  contacts?: { input?: string; wa_id?: string }[];
  messages?: { id?: string; message_status?: string }[];
};

type GraphTemplateWriteResponse = {
  id?: string;
  status?: string;
  category?: string;
};

type TemplateReferenceKind =
  | 'tenant_template_grant'
  | 'tenant_outreach_config'
  | 'tenant_list_campaign'
  | 'tenant_on_demand_send'
  | 'tenant_on_demand_schedule';

@Injectable()
export class WhatsappTemplatesService {
  private readonly logger = new Logger(WhatsappTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappAdminService,
  ) {}

  async sync() {
    // Números extras compartilham o catálogo do WABA; não copiar rows.
    const creds = await this.platformWhatsapp.resolveCredentials();
    if (!creds.wabaId?.trim()) {
      throw new BadRequestException(
        'wabaId da conta WhatsApp da plataforma está vazio',
      );
    }

    const templates = await this.fetchAllTemplates(creds.wabaId, creds.token);
    const now = new Date();
    let upserted = 0;

    for (const item of templates) {
      const name = (item.name ?? '').trim();
      const language = (item.language ?? '').trim();
      if (!name || !language) {
        continue;
      }
      const components = (item.components ?? []) as Prisma.InputJsonValue;
      const slots = parseTemplateSlots(
        item.components,
      ) as unknown as Prisma.InputJsonValue;
      await this.prisma.whatsappMessageTemplate.upsert({
        where: {
          whatsappAccountId_name_language: {
            whatsappAccountId: creds.accountId,
            name,
            language,
          },
        },
        create: {
          whatsappAccountId: creds.accountId,
          metaId: item.id ?? null,
          name,
          language,
          status: item.status ?? 'UNKNOWN',
          category: item.category ?? null,
          parameterFormat: item.parameter_format ?? null,
          components,
          slots,
          lastSyncedAt: now,
        },
        update: {
          metaId: item.id ?? null,
          status: item.status ?? 'UNKNOWN',
          category: item.category ?? null,
          parameterFormat: item.parameter_format ?? null,
          components,
          slots,
          lastSyncedAt: now,
        },
      });
      upserted += 1;
    }

    return { upserted, accountId: creds.accountId };
  }

  async list(filters: { status?: string; name?: string }) {
    const status = filters.status?.trim();
    const name = filters.name?.trim();
    const rows = await this.prisma.whatsappMessageTemplate.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(name
          ? { name: { contains: name, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { language: 'asc' }],
    });

    return rows.map((row) => toTemplatePreviewDto(row));
  }

  async getById(id: number) {
    const row = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `WhatsappMessageTemplate id=${id} não encontrado`,
      );
    }
    return toTemplatePreviewDto(row);
  }

  async create(dto: CreateWhatsappTemplateDto) {
    if (dto.category !== 'MARKETING') {
      throw new BadRequestException('category deve ser MARKETING no MVP');
    }
    assertValidMarketingTemplateComponents(dto.components);

    const creds = await this.platformWhatsapp.resolveCredentials();
    if (!creds.wabaId?.trim()) {
      throw new BadRequestException(
        'wabaId da conta WhatsApp da plataforma está vazio',
      );
    }

    const graphBody: Record<string, unknown> = {
      name: dto.name,
      language: dto.language,
      category: 'MARKETING',
      components: dto.components,
    };
    if (dto.parameterFormat) {
      graphBody.parameter_format = dto.parameterFormat;
    }

    let graphData: GraphTemplateWriteResponse;
    try {
      const res =
        await this.httpService.axiosRef.post<GraphTemplateWriteResponse>(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.wabaId}/message_templates`,
          graphBody,
          {
            headers: {
              Authorization: `Bearer ${creds.token}`,
              'Content-Type': 'application/json',
            },
          },
        );
      graphData = res.data ?? {};
    } catch (error) {
      this.rethrowGraphError(error);
    }

    const now = new Date();
    const components = dto.components as unknown as Prisma.InputJsonValue;
    const slots = parseTemplateSlots(
      dto.components,
    ) as unknown as Prisma.InputJsonValue;
    const status = (graphData.status ?? 'PENDING').trim() || 'PENDING';
    const metaId = graphData.id?.trim() || null;
    const category = graphData.category?.trim() || 'MARKETING';

    const row = await this.prisma.whatsappMessageTemplate.upsert({
      where: {
        whatsappAccountId_name_language: {
          whatsappAccountId: creds.accountId,
          name: dto.name,
          language: dto.language,
        },
      },
      create: {
        whatsappAccountId: creds.accountId,
        metaId,
        name: dto.name,
        language: dto.language,
        status,
        category,
        parameterFormat: dto.parameterFormat ?? null,
        components,
        slots,
        lastSyncedAt: now,
      },
      update: {
        metaId,
        status,
        category,
        parameterFormat: dto.parameterFormat ?? null,
        components,
        slots,
        lastSyncedAt: now,
      },
    });

    return toTemplatePreviewDto(row);
  }

  async patch(id: number, dto: PatchWhatsappTemplateDto) {
    if (dto.category != null && dto.category !== 'MARKETING') {
      throw new BadRequestException('category deve ser MARKETING no MVP');
    }
    assertValidMarketingTemplateComponents(dto.components);

    const existing = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `WhatsappMessageTemplate id=${id} não encontrado`,
      );
    }
    if (!existing.metaId?.trim()) {
      throw new BadRequestException(
        `Template id=${id} não possui metaId; sincronize o catálogo antes de editar`,
      );
    }

    const creds = await this.platformWhatsapp.resolveCredentials();
    const graphBody: Record<string, unknown> = {
      components: dto.components,
    };
    if (dto.category) {
      graphBody.category = dto.category;
    }

    let graphData: GraphTemplateWriteResponse;
    try {
      const res =
        await this.httpService.axiosRef.post<GraphTemplateWriteResponse>(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${existing.metaId}`,
          graphBody,
          {
            headers: {
              Authorization: `Bearer ${creds.token}`,
              'Content-Type': 'application/json',
            },
          },
        );
      graphData = res.data ?? {};
    } catch (error) {
      this.rethrowGraphError(error);
    }

    const now = new Date();
    const components = dto.components as unknown as Prisma.InputJsonValue;
    const slots = parseTemplateSlots(
      dto.components,
    ) as unknown as Prisma.InputJsonValue;
    const status =
      (graphData.status ?? existing.status).trim() || existing.status;
    const category =
      (graphData.category ?? dto.category ?? existing.category)?.trim() ||
      existing.category;

    const row = await this.prisma.whatsappMessageTemplate.update({
      where: { id },
      data: {
        components,
        slots,
        status,
        category,
        lastSyncedAt: now,
      },
    });

    return toTemplatePreviewDto(row);
  }

  async delete(id: number) {
    const existing = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `WhatsappMessageTemplate id=${id} não encontrado`,
      );
    }

    const refs = await this.collectTemplateReferences(id);
    if (refs.length > 0) {
      throw new ConflictException(
        `Não é possível excluir o template: ainda referenciado por ${refs.join(', ')}`,
      );
    }

    const creds = await this.platformWhatsapp.resolveCredentials();
    if (!creds.wabaId?.trim()) {
      throw new BadRequestException(
        'wabaId da conta WhatsApp da plataforma está vazio',
      );
    }

    const params = new URLSearchParams({ name: existing.name });
    if (existing.metaId?.trim()) {
      params.set('hsm_id', existing.metaId);
    }

    try {
      await this.httpService.axiosRef.delete(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.wabaId}/message_templates?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${creds.token}` },
        },
      );
    } catch (error) {
      this.rethrowGraphError(error);
    }

    await this.prisma.whatsappMessageTemplate.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async collectTemplateReferences(
    templateId: number,
  ): Promise<TemplateReferenceKind[]> {
    const [
      grantCount,
      outreachCount,
      notifyOutreachCount,
      campaignCount,
      notifyCampaignCount,
      sendCount,
      scheduleCount,
    ] = await Promise.all([
      this.prisma.tenantTemplateGrant.count({
        where: { templateId },
      }),
      this.prisma.tenantOutreachConfig.count({
        where: { outreachTemplateId: templateId },
      }),
      this.prisma.tenantOutreachConfig.count({
        where: { notifyTemplateId: templateId },
      }),
      this.prisma.tenantListCampaign.count({
        where: { templateId },
      }),
      this.prisma.tenantListCampaign.count({
        where: { notifyTemplateId: templateId },
      }),
      this.prisma.tenantOnDemandSend.count({
        where: { templateId },
      }),
      this.prisma.tenantOnDemandSchedule.count({
        where: { templateId },
      }),
    ]);

    const refs: TemplateReferenceKind[] = [];
    if (grantCount > 0) {
      refs.push('tenant_template_grant');
    }
    if (outreachCount > 0 || notifyOutreachCount > 0) {
      refs.push('tenant_outreach_config');
    }
    if (campaignCount > 0 || notifyCampaignCount > 0) {
      refs.push('tenant_list_campaign');
    }
    if (sendCount > 0) {
      refs.push('tenant_on_demand_send');
    }
    if (scheduleCount > 0) {
      refs.push('tenant_on_demand_schedule');
    }
    return refs;
  }

  async testSend(
    id: number,
    dto: TestWhatsappTemplateDto,
    operatorUserId?: number,
  ) {
    const template = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(
        `WhatsappMessageTemplate id=${id} não encontrado`,
      );
    }
    if (template.status.toUpperCase() !== 'APPROVED') {
      throw new BadRequestException(
        `Template id=${id} não está APPROVED (status=${template.status})`,
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

    const slots = resolveTemplateSlots(template.slots, template.components);
    const variables = dto.variables ?? {};
    const values: Record<string, string> = {};
    const missing: string[] = [];

    for (const slot of slots) {
      const resolved = this.resolveTestSlotValue(slot, variables, leadCtx);
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

    const to = normalizeBrazilPhoneDigits(dto.to);
    if (!to || to === '—') {
      throw new BadRequestException('Telefone de destino inválido');
    }

    const creds = await this.resolveTestSendCredentials(dto.whatsappAccountId);
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
      `test-send user=${operatorUserId ?? 'unknown'} templateId=${id} to=${to}`,
    );

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
      const wamid = res.data.messages?.[0]?.id ?? null;
      if (wamid) {
        await this.persistDedicatedTestSendConversation({
          accountId: creds.accountId,
          wamid,
          to,
          templateName: template.name,
          graphPayload,
          leadName: leadCtx?.name ?? null,
        });
      }
      return {
        wamid,
        to,
        messageStatus: res.data.messages?.[0]?.message_status ?? null,
      };
    } catch (error) {
      this.rethrowGraphError(error);
    }
  }

  private async persistDedicatedTestSendConversation(input: {
    accountId: number;
    wamid: string;
    to: string;
    templateName: string;
    graphPayload: Record<string, unknown>;
    leadName: string | null;
  }) {
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { whatsappAccountId: input.accountId },
      select: {
        tenantId: true,
        whatsappAccount: { select: { isDefault: true } },
      },
    });
    if (
      !config?.whatsappAccount ||
      !isDedicatedPlatformAccount(config.whatsappAccount)
    ) {
      return;
    }

    const phone = normalizeListPhone(input.to);
    const trimmedLeadName = input.leadName?.trim() ?? '';
    const displayName = trimmedLeadName.length > 0 ? trimmedLeadName : phone;
    const now = new Date();

    const conversation = await this.prisma.whatsappConversation.upsert({
      where: {
        tenantId_phone: { tenantId: config.tenantId, phone },
      },
      create: {
        tenantId: config.tenantId,
        phone,
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
        phone,
        tenantId: config.tenantId,
        conversationId: conversation.id,
      },
    });
  }

  private async resolveTestSendCredentials(whatsappAccountId?: number) {
    const defaultCreds = await this.platformWhatsapp.resolveCredentials();
    if (whatsappAccountId == null) {
      return defaultCreds;
    }

    const account = await this.prisma.whatsappAccount.findUnique({
      where: { id: whatsappAccountId },
    });
    if (
      !account ||
      account.tenantId != null ||
      !account.enabled ||
      (account.wabaId ?? '') !== defaultCreds.wabaId
    ) {
      throw new BadRequestException(
        `WhatsappAccount id=${whatsappAccountId} inválida para test-send (inexistente, disabled, não-plataforma ou WABA divergente)`,
      );
    }

    const token = process.env[account.tokenEnvKey];
    if (!token) {
      throw new BadRequestException(
        `Token WhatsApp ausente: variável de ambiente "${account.tokenEnvKey}" não está definida ou está vazia`,
      );
    }

    return {
      accountId: account.id,
      wabaId: account.wabaId ?? '',
      phoneNumberId: account.phoneNumberId,
      token,
      messagesUrl: `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}/messages`,
    };
  }

  private resolveTestSlotValue(
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

  private async fetchAllTemplates(
    wabaId: string,
    token: string,
  ): Promise<GraphTemplate[]> {
    const collected: GraphTemplate[] = [];
    const fields =
      'id,name,language,status,category,parameter_format,components';
    let url: string | undefined = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?fields=${fields}&limit=100`;

    try {
      while (url) {
        const res = await this.httpService.axiosRef.get<GraphTemplatePage>(
          url,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        collected.push(...(res.data.data ?? []));
        url = res.data.paging?.next;
      }
    } catch (error) {
      this.rethrowGraphError(error);
    }
    return collected;
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
