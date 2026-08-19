import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '@core/infra/prisma/prisma.service';
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
import { TestWhatsappTemplateDto } from './dto/test-whatsapp-template.dto';
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

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      language: row.language,
      status: row.status,
      category: row.category,
      parameterFormat: row.parameterFormat,
      slots: this.asSlots(row.slots, row.components),
      lastSyncedAt: row.lastSyncedAt,
      components: row.components,
    }));
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

    const slots = this.asSlots(template.slots, template.components);
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

    this.logger.log(
      `test-send user=${operatorUserId ?? 'unknown'} templateId=${id} to=${to}`,
    );

    try {
      const res = await this.httpService.axiosRef.post<GraphSendResponse>(
        creds.messagesUrl,
        {
          ...sendBody,
          recipient_type: 'individual',
          to,
        },
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const wamid = res.data.messages?.[0]?.id ?? null;
      return {
        wamid,
        to,
        messageStatus: res.data.messages?.[0]?.message_status ?? null,
      };
    } catch (error) {
      this.rethrowGraphError(error);
    }
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

  private asSlots(slotsJson: unknown, components: unknown): TemplateSlot[] {
    if (Array.isArray(slotsJson) && slotsJson.length > 0) {
      return slotsJson as TemplateSlot[];
    }
    return parseTemplateSlots(components);
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
