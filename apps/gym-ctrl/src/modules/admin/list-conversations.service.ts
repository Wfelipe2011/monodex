import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import {
  Prisma,
  WhatsappConversationDirection,
} from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import { LeadListsService } from './lead-lists.service';
import { PlatformWhatsappAdminService } from './platform-whatsapp-admin.service';
import { SendListConversationMessageDto } from './dto/send-list-conversation-message.dto';

const MESSAGE_SELECT = {
  id: true,
  wamid: true,
  direction: true,
  type: true,
  body: true,
  createdAt: true,
} satisfies Prisma.WhatsappConversationMessageSelect;

const MAX_TEXT_LENGTH = 4096;

type GraphSendResponse = {
  messaging_product?: string;
  contacts?: { input?: string; wa_id?: string }[];
  messages?: { id?: string; message_status?: string }[];
};

@Injectable()
export class ListConversationsService {
  private readonly logger = new Logger(ListConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly leadListsService: LeadListsService,
    private readonly platformWhatsapp: PlatformWhatsappAdminService,
  ) {}

  async listMessages(
    tenantId: number,
    listId: number,
    leadId: number,
    since?: string,
  ) {
    await this.leadListsService.getLead(tenantId, listId, leadId);

    let sinceDate: Date | undefined;
    if (since !== undefined && since !== '') {
      sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        throw new BadRequestException('since deve ser ISO8601 válido');
      }
    }

    return this.prisma.whatsappConversationMessage.findMany({
      where: {
        listLeadId: leadId,
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendTextMessage(
    tenantId: number,
    listId: number,
    leadId: number,
    dto: SendListConversationMessageDto,
  ) {
    const lead = await this.leadListsService.getLead(tenantId, listId, leadId);
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('text não pode ser vazio');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `text excede o limite de ${MAX_TEXT_LENGTH} caracteres`,
      );
    }

    const phone = normalizeListPhone(lead.phone);
    if (!phone) {
      throw new BadRequestException('Telefone do lead inválido');
    }

    const windowStart = subHours(new Date(), 24);
    const lastInbound = await this.prisma.whatsappConversationMessage.findFirst({
      where: {
        listLeadId: leadId,
        phone,
        direction: WhatsappConversationDirection.IN,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastInbound) {
      throw new BadRequestException('OUTSIDE_MESSAGING_WINDOW');
    }

    const creds = await this.platformWhatsapp.resolveCredentials(tenantId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { body: text },
    };

    this.logger.log(
      `send-text tenant=${tenantId} list=${listId} lead=${leadId} to=${phone}`,
    );

    let graphResponse: GraphSendResponse;
    try {
      const res = await this.httpService.axiosRef.post<GraphSendResponse>(
        creds.messagesUrl,
        payload,
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      graphResponse = res.data;
    } catch (error) {
      this.rethrowGraphError(error);
    }

    const wamid = graphResponse.messages?.[0]?.id;
    if (!wamid) {
      throw new BadGatewayException(
        'Graph API não retornou wamid para mensagem de texto',
      );
    }

    return this.prisma.whatsappConversationMessage.create({
      data: {
        wamid,
        direction: WhatsappConversationDirection.OUT,
        type: 'text',
        body: text,
        raw: graphResponse as unknown as Prisma.InputJsonValue,
        phone,
        tenantId,
        listLeadId: leadId,
      },
      select: MESSAGE_SELECT,
    });
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

function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}
